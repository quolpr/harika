import {
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { cloneDeep } from 'lodash';
import { set } from 'lodash';
import type { SyncEntitiesService } from './types';
import { Logger, UseFilters } from '@nestjs/common';
import { inspect } from 'util';
import type { ClientIdentityService } from './clientIdentity.service';
import { parse } from 'cookie';
import * as jwt from 'jsonwebtoken';
import { AllExceptionsFilter } from '../core/AllExceptionsFilter';
import {
  CommandFromClientHandled,
  CommandTypesFromClient,
  EventTypesFromServer,
  IDatabaseChange,
  ICreateChange,
  IUpdateChange,
  CommandTypesFromServer,
  ApplyNewChangesFromServer,
  MessageType,
  DatabaseChangeType,
  ApplyNewChangesFromClient,
  InitializeClient,
  SubscribeClientToChanges,
} from '@harika/common';
import { v4 } from 'uuid';

export abstract class SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private syncEntities: SyncEntitiesService,
    protected logger: Logger,
    private identityService: ClientIdentityService,
  ) {}

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
        subscriptionState:
          | {
              subscribed: true;
              currentRev: number | null;
            }
          | { subscribed: false };
        currentUserId: string;
      }
  >();

  @UseFilters(new AllExceptionsFilter())
  @SubscribeMessage(CommandTypesFromClient.InitializeClient)
  async handleInitialize(client: Socket, command: InitializeClient) {
    const state = this.socketIOLocals.get(client);
    if (!state) {
      throw new WsException('no state set');
    }

    if (state?.type === 'initialized') {
      throw new WsException('already initialized!');
    }

    // TODO maybe set clientIdentity on server? To avoid possible secure issues
    this.logger.debug(
      `[${command.scopeId}] [${command.identity}] handleInitialize - ${inspect(
        command,
        false,
        6,
      )}`,
    );

    if (!(await this.auth(command.scopeId, state.currentUserId))) {
      throw new WsException('not authed!');
    }

    this.socketIOLocals.set(client, {
      clientIdentity: command.identity,
      scopeId: command.scopeId,
      type: 'initialized',
      subscriptionState: { subscribed: false },
      currentUserId: state.currentUserId,
    });

    client.emit(EventTypesFromServer.CommandHandled, {
      status: 'ok',
      handledId: command.id,
    } as CommandFromClientHandled);
  }

  @UseFilters(new AllExceptionsFilter())
  @SubscribeMessage(CommandTypesFromClient.SubscribeClientToChanges)
  async handleSubscribeToChanges(
    client: Socket,
    command: SubscribeClientToChanges,
  ) {
    try {
      const state = this.getSocketState(client);

      if (state.type !== 'initialized')
        throw "Can't send changes to uninitialized client";

      this.logger.debug(
        `[${state.scopeId}] [${
          state.clientIdentity
        }] subscribeToChanges - ${inspect(command, false, 6)}`,
      );

      this.socketIOLocals.set(client, {
        ...state,
        subscriptionState: {
          subscribed: true,
          currentRev:
            command.syncedRevision === null ? 0 : command.syncedRevision,
        },
      });

      await this.sendAnyChanges(client);

      client.emit(EventTypesFromServer.CommandHandled, {
        status: 'ok',
        handledId: command.id,
      } as CommandFromClientHandled);
    } catch (e) {
      throw new WsException('error happened: ' + e.message);
    }
  }

  @UseFilters(new AllExceptionsFilter())
  @SubscribeMessage(CommandTypesFromClient.ApplyNewChanges)
  async applyNewChanges(client: Socket, command: ApplyNewChangesFromClient) {
    try {
      const state = this.getSocketState(client);

      console.log({ state });
      if (state.type === 'notInitialized') {
        throw new Error('Not initialized');
      }

      this.logger.debug(
        `[${state.scopeId}] [${
          state.clientIdentity
        }] receivedChangesFromClient - ${inspect(command, false, 6)}`,
      );

      const baseRevision = command.baseRevision || 0;
      const serverChanges = (
        await this.syncEntities.getChangesFromRev(
          state.scopeId,
          state.currentUserId,
          baseRevision,
          state.clientIdentity,
        )
      ).changes;

      const reducedServerChangeSet = reduceChanges(serverChanges);

      console.log(
        inspect({ serverChanges, reducedServerChangeSet }, false, 10),
      );

      const resolved = resolveConflicts(
        command.changes,
        reducedServerChangeSet,
      );

      await this.syncEntities.applyChanges(
        resolved,
        state.scopeId,
        state.currentUserId,
        state.clientIdentity,
      );

      client.emit(EventTypesFromServer.CommandHandled, {
        status: 'ok',
        handledId: command.id,
      } as CommandFromClientHandled);

      await Promise.all(
        Array.from(this.socketIOLocals.entries()).map(
          ([subscriber, subscriberState]) => {
            if (
              subscriberState.type === 'initialized' &&
              subscriberState.scopeId === state.scopeId &&
              subscriberState.subscriptionState.subscribed
            ) {
              return this.sendAnyChanges(subscriber);
            }
          },
        ),
      );
    } catch (e) {
      client.emit(EventTypesFromServer.CommandHandled, {
        status: 'error',
        handledId: command.id,
      } as CommandFromClientHandled);

      console.error(e);
    }
  }

  handleConnection(client: Socket) {
    try {
      console.log({ handshake: client.handshake.headers.cookie });

      const { harikaAuthToken } = parse(client.handshake.headers.cookie);

      const { userId } = jwt.verify(
        harikaAuthToken,
        process.env.AUTH_SECRET as string,
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
      console.error('Error on connect happened', { mes: e.message });
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

    if (!state.subscriptionState.subscribed) throw 'not subscribed!';

    const currentClientRev = state.subscriptionState.currentRev;

    // Get all changes after syncedRevision that was not performed by the client we're talkin' to.
    const { changes, lastRev } = await this.syncEntities.getChangesFromRev(
      state.scopeId,
      state.currentUserId,
      currentClientRev === null ? 0 : currentClientRev,
      state.clientIdentity,
    );

    // Compact changes so that multiple changes on same object is merged into a single change.
    const reducedSet = reduceChanges(changes);

    console.log(inspect({ changes, reducedSet }, false, 10));

    // Convert the reduced set into an array again.
    const reducedArray = Object.keys(reducedSet).map(function (key) {
      return reducedSet[key];
    });
    // Notice the current revision of the database. We want to send it to client so it knows what to ask for next time.

    const toSend: ApplyNewChangesFromServer = {
      id: v4(),
      messageType: MessageType.Command,
      type: CommandTypesFromServer.ApplyNewChanges,
      changes: reducedArray,
      currentRevision: lastRev,
      partial: false,
    };

    client.emit(CommandTypesFromServer.ApplyNewChanges, toSend);

    state.subscriptionState.currentRev = lastRev;

    this.logger.debug(
      `[${state.scopeId}] [${
        state.clientIdentity
      }] changesToClientSent - ${inspect(
        toSend,
        false,
        6,
      )}, new rev set - ${lastRev}, prev rev - ${currentClientRev}`,
    );
  }

  protected abstract auth(
    scopeId: string,
    currentUserId: string,
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
  serverChangeSet: Record<string, IDatabaseChange>,
) {
  const resolved: IDatabaseChange[] = [];

  console.log(inspect({ clientChanges, serverChangeSet }, false, 6));

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
  nextChange: IUpdateChange,
) {
  const clonedChange = cloneDeep(prevChange); // Clone object before modifying since the earlier change in db.changes[] would otherwise be altered.
  applyModifications(clonedChange.obj, nextChange.mods); // Apply modifications to existing object.
  return clonedChange;
}

function applyModifications(
  obj: Record<string, unknown>,
  modifications: IUpdateChange['mods'],
) {
  Object.keys(modifications).forEach(function (keyPath) {
    set(obj, keyPath, modifications[keyPath]);
  });
}

function combineUpdateAndUpdate(
  prevChange: IUpdateChange,
  nextChange: IUpdateChange,
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
          nextChange.mods[keyPath],
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