import {
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { SyncEntitiesService } from './types';
import { Logger, UseFilters } from '@nestjs/common';
import { inspect } from 'util';
import { parse } from 'cookie';
import * as jwt from 'jsonwebtoken';
import { AllExceptionsFilter } from '../core/AllExceptionsFilter';
import {
  CommandTypesFromClient,
  EventTypesFromServer,
  MessageType,
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
  ) {}

  private socketIOLocals = new Map<
    Socket,
    | {
        type: 'notInitialized';
        currentUserId: string;
      }
    | InitializedClientState
  >();

  @UseFilters(new AllExceptionsFilter())
  @SubscribeMessage(CommandTypesFromClient.InitializeClient)
  async handleInitialize(client: Socket, command: InitializeClientRequest) {
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

    if (state.type !== 'initialized')
      throw "Can't send changes to uninitialized client";

    // Get all changes after syncedRevision that was not performed by the client we're talkin' to.
    const { changes, lastRev } = await this.syncEntities.getChangesFromRev(
      state.scopeId,
      state.currentUserId,
      command.data.fromRevision === null ? 0 : command.data.fromRevision,
      state.clientIdentity,
    );

    const toSend: GetChangesResponse = {
      messageId: v4(),
      type: CommandTypesFromClient.GetChanges,
      messageType: MessageType.CommandResponse,
      requestedMessageId: command.messageId,
      data: {
        status: 'success',
        changes: changes,
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

  // TODO: move to redis
  private lockedChanges: Record<string, true> = {};

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

      if (this.lockedChanges[state.clientIdentity + state.scopeId]) {
        const response: ApplyNewChangesFromClientResponse = {
          messageId: v4(),
          type: CommandTypesFromClient.ApplyNewChanges,
          messageType: MessageType.CommandResponse,
          requestedMessageId: request.messageId,
          data: {
            status: 'locked',
          },
        };

        client.emit(CommandTypesFromClient.ApplyNewChanges, response);

        return;
      }

      this.lockedChanges[state.clientIdentity + state.scopeId] = true;

      try {
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
      } finally {
        delete this.lockedChanges[state.clientIdentity + state.scopeId];
      }
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
