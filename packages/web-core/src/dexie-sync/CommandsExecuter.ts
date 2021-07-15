import { Subject, Observable } from 'rxjs';
import {
  catchError,
  first,
  mapTo,
  retry,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';
import type { ClientCommands } from '@harika/common';
import type Phoenix from 'phoenix';
import snakecaseKeys from 'snakecase-keys';
import camelcaseKeys from 'camelcase-keys';

export class CommandsExecuter {
  constructor(
    private socket$: Observable<Phoenix.Socket>,
    private channel$: Observable<Phoenix.Channel>,
    private log: (str: string) => void,
    private stop$: Subject<void>,
  ) {}

  send<T extends ClientCommands, K extends unknown = unknown>(
    commandType: T['type'],
    commandFunction: (val: K) => T['request'],
  ) {
    return (source: Observable<K>) => {
      return source.pipe(
        switchMap((val) => {
          const command = commandFunction(val);

          return this.channel$.pipe(
            switchMap((channel) => {
              return new Observable<T['response']>((observer) => {
                channel
                  .push(commandType, snakecaseKeys(command, { deep: true }))
                  .receive('ok', (msg) => {
                    observer.next(
                      camelcaseKeys(msg, { deep: true }) as T['response'],
                    );
                  })
                  .receive('error', (reasons) => {
                    this.log(`command failed ${JSON.stringify(reasons)}`);

                    observer.error();
                  })
                  .receive('timeout', () => {
                    this.log(`command timeout`);

                    observer.error();
                  });
              });
            }),
            take(1),
            retry(3),
            catchError(() => {
              this.log(
                `Failed to send command: ${JSON.stringify(
                  command,
                )}. Reconnecting`,
              );

              return this.socket$.pipe(
                tap((socket) => {
                  socket.disconnect();
                  socket.connect();
                }),
                first(),
                mapTo(null),
              );
            }),
          );
        }),
      );
    };
  }
}
