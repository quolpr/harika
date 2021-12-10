import { Observable } from 'rxjs';
import {
  catchError,
  first,
  mapTo,
  retry,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs/operators';
import type { ClientCommands } from '@harika/sync-common';
import { Socket } from 'socket.io-client';

export class CommandsExecuter {
  private i = 0;
  constructor(
    private socket$: Observable<Socket | undefined>,
    private log: (str: string) => void,
    private stop$: Observable<unknown>,
  ) {}

  send<T extends ClientCommands>(
    commandType: T['type'],
    command: T['request'],
  ) {
    const id = this.i++;

    return this.socket$.pipe(
      switchMap((socket) => {
        if (socket) {
          return this.newMessageSender(socket, commandType, command, id);
        } else {
          throw new Error('Not connected');
        }
      }),
      retry(3),
      catchError(() => {
        this.log(
          `[${id}] Failed to send command: ${JSON.stringify(
            command,
          )}. Reconnecting`,
        );

        return this.socket$.pipe(
          tap((socket) => {
            socket?.disconnect();
            socket?.connect();
          }),
          first(),
          mapTo(null),
        );
      }),
      take(1),
      takeUntil(this.stop$),
    );
  }

  private newMessageSender<T extends ClientCommands>(
    socket: Socket,
    commandType: T['type'],
    command: T['request'],
    requestId: number,
  ) {
    return new Observable<T['response']>((observer) => {
      let isRunning = true;

      this.log(
        `[requestId=${requestId}] Sending message ${JSON.stringify(
          command,
          null,
          2,
        )}`,
      );

      if (!socket) {
        observer.error('Channel is not set. Is new leader elected?');

        return;
      }

      const timeout = setTimeout(() => {
        if (!isRunning) return;

        this.log(`[requestId=${requestId}] Command timeout`);
      }, 10_000);

      socket.emit(commandType, command, (resp: T['response']) => {
        if (!isRunning) return;

        clearTimeout(timeout);

        this.log(
          `[requestId=${requestId}] Response received, ${JSON.stringify(
            resp,
            null,
            2,
          )}`,
        );

        observer.next(resp);
      });

      return () => {
        isRunning = false;
      };
    });
  }
}
