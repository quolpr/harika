import {
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import cloneDeep from 'lodash.clonedeep';
import set from 'lodash.set';
import {
  DatabaseChangeType,
  ICreateChange,
  IDatabaseChange,
  IUpdateChange,
  SyncEntitiesService,
} from './types';
import { Catch, Logger, UseFilters } from '@nestjs/common';
import { inspect } from 'util';
import { ClientIdentityService } from './clientIdentity.service';
import { parse } from 'cookie';
import { environment } from '../../environments/environment';
import * as jwt from 'jsonwebtoken';
import { AllExceptionsFilter } from '../core/AllExceptionsFilter';

interface BaseRequest {
  requestId: string;
}

interface IApplyNewChangesRequest extends BaseRequest {
  changes: IDatabaseChange[];
  partial: boolean;
  baseRevision: number;
}

interface ISubscribeToChangesRequest extends BaseRequest {
  syncedRevision: number;
}

interface IInitializeRequest extends BaseRequest {
  identity: string;
  scopeId: string;
}

// type IResponseEvents =
//   | {
//       type: 'clientIdentitySet';
//       identity: string;
//     }
//   | {
//       type: 'error';
//       message: string;
//     }
//   | { type: 'done' };

// TODO: add typing to events
export abstract class SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private syncEntities: SyncEntitiesService,
    protected logger: Logger,
    private identityService: ClientIdentityService
  ) {}

  // TODO: maybe redis?
  private socketIOLocals = new Map<
    Socket,
    | {
        type: 'notInitialized';
        currentUserId: string;
      }
    | {
        clientIdentity: string;
        scopeId: string;
        type: 'initialized';
        subscribeToChanges: boolean;
        currentUserId: string;
      }
  >();

  @UseFilters(new AllExceptionsFilter())
  @SubscribeMessage('initialize')
  async handleInitialize(client: Socket, event: IInitializeRequest) {
    const state = this.socketIOLocals.get(client);
    if (!state) {
      throw new WsException('no state set');
    }

    if (state?.type === 'initialized') {
      throw new WsException('already initialized!');
    }

    // TODO maybe set clientIdentity on server? To avoid possible secure issues
    this.logger.debug(
      `[${event.scopeId}] [${event.identity}] handleInitialize - ${inspect(
        event,
        false,
        6
      )}`
    );

    if (!(await this.auth(event.scopeId, state.currentUserId))) {
      throw new WsException('not authed!');
    }

    this.socketIOLocals.set(client, {
      clientIdentity: event.identity,
      scopeId: event.scopeId,
      type: 'initialized',
      subscribeToChanges: false,
      currentUserId: state.currentUserId,
    });

    client.emit('requestHandled', { status: 'ok', requestId: event.requestId });
  }

  @UseFilters(new AllExceptionsFilter())
  @SubscribeMessage('subscribeToChanges')
  async handleSubscribeToChanges(
    client: Socket,
    event: ISubscribeToChangesRequest
  ) {
    try {
      const state = this.getSocketState(client);

      if (state.type !== 'initialized')
        throw "Can't send changes to uninitialized client";

      this.logger.debug(
        `[${state.scopeId}] [${
          state.clientIdentity
        }] subscribeToChanges - ${inspect(event, false, 6)}`
      );

      this.socketIOLocals.set(client, { ...state, subscribeToChanges: true });

      await this.sendAnyChanges(client);
    } catch (e) {
      throw new WsException('error happened: ' + e.message);
    }
  }

  @UseFilters(new AllExceptionsFilter())
  @SubscribeMessage('applyNewChanges')
  async applyNewChanges(client: Socket, event: IApplyNewChangesRequest) {
    try {
      const state = this.getSocketState(client);

      if (state.type === 'notInitialized') {
        throw new Error('Not initialized');
      }

      this.logger.debug(
        `[${state.scopeId}] [${
          state.clientIdentity
        }] receivedChangesFromClient - ${inspect(event, false, 6)}`
      );

      const baseRevision = event.baseRevision || 0;
      const serverChanges = (
        await this.syncEntities.getChangesFromRev(
          state.scopeId,
          state.currentUserId,
          baseRevision,
          state.clientIdentity
        )
      ).changes;

      const reducedServerChangeSet = reduceChanges(serverChanges);

      const resolved = resolveConflicts(event.changes, reducedServerChangeSet);

      await this.syncEntities.applyChanges(
        resolved,
        state.scopeId,
        state.currentUserId,
        state.clientIdentity
      );

      client.emit('requestHandled', {
        status: 'ok',
        requestId: event.requestId,
      });

      await Promise.all(
        Array.from(this.socketIOLocals.entries()).map(
          ([subscriber, subscriberState]) => {
            if (
              subscriberState.type === 'initialized' &&
              subscriberState.scopeId === state.scopeId &&
              subscriberState.subscribeToChanges
            ) {
              return this.sendAnyChanges(subscriber);
            }
          }
        )
      );
    } catch (e) {
      client.emit('requestHandled', {
        status: 'error',
        requestId: event.requestId,
      });
      console.error(e);
    }
  }

  @UseFilters(new AllExceptionsFilter())
  handleConnection(client: Socket) {
    try {
      const { harikaAuthToken } = parse(client.handshake.headers.cookie);
      const { userId } = jwt.verify(
        harikaAuthToken,
        environment.userSecret
      ) as {
        userId: string;
      };

      if (!userId) {
        throw new Error('should be authed!');
      }

      this.socketIOLocals.set(client, {
        type: 'notInitialized',
        currentUserId: userId,
      });
    } catch (e) {
      console.log({ mes: e.message });
      throw new WsException(`error happened: ${e.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.socketIOLocals.delete(client);
  }

  private getSocketState(client: Socket) {
    const state = this.socketIOLocals.get(client);

    if (!state) throw new Error('Client state was not set!');

    return state;
  }

  // TODO: redis lock here on clientIdentity
  private async sendAnyChanges(client: Socket) {
    const state = this.getSocketState(client);

    if (state.type !== 'initialized')
      throw "Can't send changes to uninitialized client";

    const currentClientRev = await this.identityService.getLastRev(
      state.currentUserId,
      state.clientIdentity
    );

    // Get all changes after syncedRevision that was not performed by the client we're talkin' to.
    const { changes, lastRev } = await this.syncEntities.getChangesFromRev(
      state.scopeId,
      state.currentUserId,
      currentClientRev,
      state.clientIdentity
    );
    // Compact changes so that multiple changes on same object is merged into a single change.
    const reducedSet = reduceChanges(changes);
    // Convert the reduced set into an array again.
    const reducedArray = Object.keys(reducedSet).map(function (key) {
      return reducedSet[key];
    });
    // Notice the current revision of the database. We want to send it to client so it knows what to ask for next time.

    const toSend = {
      changes: reducedArray,
      currentRevision: lastRev,
      partial: false, // Tell client that these are the only changes we are aware of. Since our mem DB is syncronous, we got all changes in one chunk.
    };

    client.emit('applyNewChanges', toSend);

    await this.identityService.setNewRev(
      state.currentUserId,
      state.clientIdentity,
      lastRev
    );

    this.logger.debug(
      `[${state.scopeId}] [${
        state.clientIdentity
      }] changesToClientSent - ${inspect(
        toSend,
        false,
        6
      )}, new rev set - ${lastRev}, prev rev - ${currentClientRev}`
    );
  }

  protected abstract async auth(
    scopeId: string,
    currentUserId: string
  ): Promise<boolean>;
}

function reduceChanges(changes: IDatabaseChange[]) {
  // Converts an Array of change objects to a set of change objects based on its unique combination of (table ":" key).
  // If several changes were applied to the same object, the resulting set will only contain one change for that object.
  return changes.reduce(function (set, nextChange) {
    const id = nextChange.table + ':' + nextChange.key;
    const prevChange = set[id];
    if (!prevChange) {
      // This is the first change on this key. Add it unless it comes from the source that we are working against
      set[id] = nextChange;
    } else {
      // Merge the oldchange with the new change
      set[id] = (function () {
        switch (prevChange.type) {
          case DatabaseChangeType.Create:
            switch (nextChange.type) {
              case DatabaseChangeType.Create:
                return nextChange; // Another CREATE replaces previous CREATE.
              case DatabaseChangeType.Update:
                return combineCreateAndUpdate(prevChange, nextChange); // Apply nextChange.mods into prevChange.obj
              case DatabaseChangeType.Delete:
                return nextChange; // Object created and then deleted. If it wasnt for that we MUST handle resent changes, we would skip entire change here. But what if the CREATE was sent earlier, and then CREATE/DELETE at later stage? It would become a ghost object in DB. Therefore, we MUST keep the delete change! If object doesnt exist, it wont harm!
            }
            break;
          case DatabaseChangeType.Update:
            switch (nextChange.type) {
              case DatabaseChangeType.Create:
                return nextChange; // Another CREATE replaces previous update.
              case DatabaseChangeType.Update:
                return combineUpdateAndUpdate(prevChange, nextChange); // Add the additional modifications to existing modification set.
              case DatabaseChangeType.Delete:
                return nextChange; // Only send the delete change. What was updated earlier is no longer of interest.
            }
            break;
          case DatabaseChangeType.Delete:
            switch (nextChange.type) {
              case DatabaseChangeType.Create:
                return nextChange; // A resurection occurred. Only create change is of interest.
              case DatabaseChangeType.Update:
                return prevChange; // Nothing to do. We cannot update an object that doesnt exist. Leave the delete change there.
              case DatabaseChangeType.Delete:
                return prevChange; // Still a delete change. Leave as is.
            }
            break;
        }
      })();
    }
    return set;
  }, {} as Record<string, IDatabaseChange>);
}
function resolveConflicts(
  clientChanges: IDatabaseChange[],
  serverChangeSet: Record<string, IDatabaseChange>
) {
  const resolved: IDatabaseChange[] = [];

  clientChanges.forEach(function (clientChange) {
    const id = clientChange.table + ':' + clientChange.key;
    const serverChange = serverChangeSet[id];
    if (!serverChange) {
      // No server change on same object. Totally conflict free!
      resolved.push(clientChange);
    } else if (serverChange.type == DatabaseChangeType.Update) {
      // Server change overlaps. Only if server change is not CREATE or DELETE, we should consider merging in the client change.
      switch (clientChange.type) {
        case DatabaseChangeType.Create:
          // Server has updated an object with same key as client has recreated. Let the client recreation go through, but also apply server modifications.
          applyModifications(clientChange.obj, serverChange.mods); // No need to clone clientChange.obj beofre applying modifications since noone else refers to clientChanges (it was retrieved from the socket connection in current request)
          resolved.push(clientChange);
          break;
        case DatabaseChangeType.Update:
          // Server and client has updated the same obejct. Just remove any overlapping keyPaths and only apply non-conflicting parts.
          Object.keys(serverChange.mods).forEach(function (keyPath) {
            // Remote this property from the client change
            delete clientChange.mods[keyPath];
            // Also, remote all changes to nestled objects under this keyPath from the client change:
            Object.keys(clientChange.mods).forEach(function (clientKeyPath) {
              if (clientKeyPath.indexOf(keyPath + '.') == 0) {
                delete clientChange.mods[clientKeyPath];
              }
            });
          });
          // Did we delete all keyPaths in the modification set of the clientChange?
          if (Object.keys(clientChange.mods).length > 0) {
            // No, there were some still there. Let this wing-clipped change be applied:
            resolved.push(clientChange);
          }
          break;
        case DatabaseChangeType.Delete:
          // Delete always win over update. Even client over a server
          resolved.push(clientChange);
          break;
      }
    } // else if serverChange.type is CREATE or DELETE, dont push anything to resolved, because the client change is not of any interest (CREATE or DELETE would eliminate any client change with same key!)
  });
  return resolved;
}

function combineCreateAndUpdate(
  prevChange: ICreateChange,
  nextChange: IUpdateChange
) {
  const clonedChange = cloneDeep(prevChange); // Clone object before modifying since the earlier change in db.changes[] would otherwise be altered.
  applyModifications(clonedChange.obj, nextChange.mods); // Apply modifications to existing object.
  return clonedChange;
}

function applyModifications(
  obj: Record<string, unknown>,
  modifications: Record<string, string>
) {
  Object.keys(modifications).forEach(function (keyPath) {
    set(obj, keyPath, modifications[keyPath]);
  });
}

function combineUpdateAndUpdate(
  prevChange: IUpdateChange,
  nextChange: IUpdateChange
) {
  const clonedChange = cloneDeep(prevChange); // Clone object before modifying since the earlier change in db.changes[] would otherwise be altered.
  Object.keys(nextChange.mods).forEach(function (keyPath) {
    // If prev-change was changing a parent path of this keyPath, we must update the parent path rather than adding this keyPath
    let hadParentPath = false;
    Object.keys(prevChange.mods)
      .filter(function (parentPath) {
        return keyPath.indexOf(parentPath + '.') === 0;
      })
      .forEach(function (parentPath) {
        set(
          clonedChange.mods[parentPath],
          keyPath.substr(parentPath.length + 1),
          nextChange.mods[keyPath]
        );
        hadParentPath = true;
      });
    if (!hadParentPath) {
      // Add or replace this keyPath and its new value
      clonedChange.mods[keyPath] = nextChange.mods[keyPath];
    }
    // In case prevChange contained sub-paths to the new keyPath, we must make sure that those sub-paths are removed since
    // we must mimic what would happen if applying the two changes after each other:
    Object.keys(prevChange.mods)
      .filter(function (subPath) {
        return subPath.indexOf(keyPath + '.') === 0;
      })
      .forEach(function (subPath) {
        delete clonedChange.mods[subPath];
      });
  });
  return clonedChange;
}
