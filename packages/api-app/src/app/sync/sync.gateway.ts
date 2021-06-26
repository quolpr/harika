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
  CommandTypesFromClient,
  EventTypesFromServer,
  IDatabaseChange,
  ICreateChange,
  IUpdateChange,
  MessageType,
  DatabaseChangeType,
  InitializeClientRequest,
  InitializeClientResponse,
  GetChangesRequest,
  GetChangesResponse,
  ApplyNewChangesFromClientRequest,
  ApplyNewChangesFromClientResponse,
  RevisionWasChangedEvent,
} from '@harika/common';
import { v4 } from 'uuid';

interface InitializedClientState {
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
// TODO: migrate to rooms
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
    | InitializedClientState
  >();

  private masters: Record<string, string> = {};

  @UseFilters(new AllExceptionsFilter())
  @SubscribeMessage(CommandTypesFromClient.InitializeClient)
  async handleInitialize(client: Socket, command: InitializeClientRequest) {
    console.log(command);

    const state = this.socketIOLocals.get(client);
    if (!state) {
      throw new WsException('no state set');
    }

    if (state?.type === 'initialized') {
      throw new WsException('already initialized!');
    }

    // TODO maybe set clientIdentity on server? To avoid possible secure issues
    this.logger.debug(
      `[${command.data.scopeId}] [${
        command.data.identity
      }] handleInitialize - ${inspect(command, false, 6)}`,
    );

    if (!(await this.auth(command.data.scopeId, state.currentUserId))) {
      throw new WsException('not authed!');
    }

    this.socketIOLocals.set(client, {
      clientIdentity: command.data.identity,
      scopeId: command.data.scopeId,
      type: 'initialized',
      subscriptionState: { subscribed: false },
      currentUserId: state.currentUserId,
    });

    const response: InitializeClientResponse = {
      messageId: v4(),
      type: CommandTypesFromClient.InitializeClient,
      messageType: MessageType.CommandResponse,
      requestedMessageId: command.messageId,
      data: {
        status: 'success',
      },
    };

    client.emit(CommandTypesFromClient.InitializeClient, response);
  }

  @UseFilters(new AllExceptionsFilter())
  @SubscribeMessage(CommandTypesFromClient.GetChanges)
  async handleGetChanges(client: Socket, command: GetChangesRequest) {
    const state = this.getSocketState(client);

    console.log('get changes!');
    if (state.type !== 'initialized')
      throw "Can't send changes to uninitialized client";

    // Get all changes after syncedRevision that was not performed by the client we're talkin' to.
    const { changes, lastRev } = await this.syncEntities.getChangesFromRev(
      state.scopeId,
      state.currentUserId,
      command.data.fromRevision === null ? 0 : command.data.fromRevision,
      state.clientIdentity,
    );

    // Compact changes so that multiple changes on same object is merged into a single change.
    const reducedSet = reduceChanges(changes);

    // Convert the reduced set into an array again.
    const reducedArray = Object.keys(reducedSet).map(function (key) {
      return reducedSet[key];
    });
    // Notice the current revision of the database. We want to send it to client so it knows what to ask for next time.

    const toSend: GetChangesResponse = {
      messageId: v4(),
      type: CommandTypesFromClient.GetChanges,
      messageType: MessageType.CommandResponse,
      requestedMessageId: command.messageId,
      data: {
        status: 'success',
        changes: reducedArray,
        currentRevision: lastRev,
      },
    };

    client.emit(CommandTypesFromClient.GetChanges, toSend);

    this.logger.debug(
      `[${state.scopeId}] [${
        state.clientIdentity
      }] changesToClientSent - ${inspect(
        toSend,
        false,
        6,
      )}, new rev set - ${lastRev}, prev rev - ${command.data.fromRevision}`,
    );
  }

  @UseFilters(new AllExceptionsFilter())
  @SubscribeMessage(CommandTypesFromClient.ApplyNewChanges)
  async applyNewChanges(
    client: Socket,
    request: ApplyNewChangesFromClientRequest,
  ) {
    try {
      const state = this.getSocketState(client);

      if (state.type === 'notInitialized') {
        throw new Error('Not initialized');
      }

      this.logger.debug(
        `[${state.scopeId}] [${
          state.clientIdentity
        }] receivedChangesFromClient - ${inspect(request, false, 6)}`,
      );

      console.log(
        request.data.lastAppliedRemoteRevision,
        await this.syncEntities.getLastRev(state.scopeId, state.currentUserId),
      );

      // TODO: lock should start here
      if (
        request.data.lastAppliedRemoteRevision !==
        (await this.syncEntities.getLastRev(state.scopeId, state.currentUserId))
      ) {
        const response: ApplyNewChangesFromClientResponse = {
          messageId: v4(),
          type: CommandTypesFromClient.ApplyNewChanges,
          messageType: MessageType.CommandResponse,
          requestedMessageId: request.messageId,
          data: {
            status: 'staleChanges',
          },
        };

        client.emit(CommandTypesFromClient.ApplyNewChanges, response);

        return;
      }

      const newRev = await this.syncEntities.applyChanges(
        request.data.changes,
        state.scopeId,
        state.currentUserId,
        state.clientIdentity,
      );

      const response: ApplyNewChangesFromClientResponse = {
        messageId: v4(),
        type: CommandTypesFromClient.ApplyNewChanges,
        messageType: MessageType.CommandResponse,
        requestedMessageId: request.messageId,
        data: {
          status: 'success',
          newRevision: newRev,
        },
      };

      client.emit(CommandTypesFromClient.ApplyNewChanges, response);

      await Promise.all(
        Array.from(this.socketIOLocals.entries()).map(
          ([subscriber, subscriberState]) => {
            if (
              subscriberState.type === 'initialized' &&
              subscriberState.scopeId === state.scopeId
            ) {
              const revisionWasChanged: RevisionWasChangedEvent = {
                messageId: v4(),
                messageType: MessageType.Event,
                eventType: EventTypesFromServer.RevisionWasChanged,
                data: {
                  newRevision: newRev,
                },
              };

              subscriber.emit(
                EventTypesFromServer.RevisionWasChanged,
                revisionWasChanged,
              );
            }
          },
        ),
      );
    } catch (e) {
      const response: ApplyNewChangesFromClientResponse = {
        messageId: v4(),
        type: CommandTypesFromClient.ApplyNewChanges,
        messageType: MessageType.CommandResponse,
        requestedMessageId: request.messageId,
        data: {
          status: 'error',
        },
      };

      client.emit(CommandTypesFromClient.ApplyNewChanges, response);

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

function combineCreateAndUpdate(
  prevChange: ICreateChange,
  nextChange: IUpdateChange,
) {
  const clonedChange = cloneDeep(prevChange); // Clone object before modifying since the earlier change in db.changes[] would otherwise be altered.
  applyModifications(clonedChange.obj, nextChange.to); // Apply modifications to existing object.
  return clonedChange;
}

function applyModifications(obj: object, modifications: IUpdateChange['to']) {
  Object.keys(modifications).forEach(function (keyPath) {
    set(obj, keyPath, modifications[keyPath]);
  });
}

function combineUpdateAndUpdate(
  prevChange: IUpdateChange,
  nextChange: IUpdateChange,
) {
  const clonedChange = cloneDeep(prevChange); // Clone object before modifying since the earlier change in db.changes[] would otherwise be altered.
  Object.keys(nextChange.to).forEach(function (keyPath) {
    // If prev-change was changing a parent path of this keyPath, we must update the parent path rather than adding this keyPath
    let hadParentPath = false;
    Object.keys(prevChange.to)
      .filter(function (parentPath) {
        return keyPath.indexOf(parentPath + '.') === 0;
      })
      .forEach(function (parentPath) {
        set(
          clonedChange.to[parentPath],
          keyPath.substr(parentPath.length + 1),
          nextChange.to[keyPath],
        );
        hadParentPath = true;
      });
    if (!hadParentPath) {
      // Add or replace this keyPath and its new value
      clonedChange.to[keyPath] = nextChange.to[keyPath];
    }
    // In case prevChange contained sub-paths to the new keyPath, we must make sure that those sub-paths are removed since
    // we must mimic what would happen if applying the two changes after each other:
    Object.keys(prevChange.to)
      .filter(function (subPath) {
        return subPath.indexOf(keyPath + '.') === 0;
      })
      .forEach(function (subPath) {
        delete clonedChange.to[subPath];
      });
  });
  return clonedChange;
}
