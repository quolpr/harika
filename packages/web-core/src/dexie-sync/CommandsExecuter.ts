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
import type { ClientCommands } from '../dexieTypes';
import type Phoenix from 'phoenix';
import snakecaseKeys from 'snakecase-keys';
import camelcaseKeys from 'camelcase-keys';

export class CommandsExecuter {
  private i = 0;
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
          const id = this.i++;

          return this.channel$.pipe(
            switchMap((channel) => {
              return new Observable<T['response']>((observer) => {
                this.log(
                  `[${id}] Sending message ${JSON.stringify(command, null, 2)}`,
                );
                channel
                  .push(
                    commandType,
                    snakecaseKeys(command, { deep: true }),
                    20_000,
                  )
                  .receive('ok', (msg) => {
                    const result = camelcaseKeys(msg, {
                      deep: true,
                    }) as T['response'];

                    this.log(
                      `[${id}] Response received, ${JSON.stringify(
                        result,
                        null,
                        2,
                      )}`,
                    );

                    observer.next(result);
                  })
                  .receive('error', (reasons) => {
                    this.log(
                      `[${id}] Command failed ${JSON.stringify(reasons)}`,
                    );

                    observer.error();
                  })
                  .receive('timeout', () => {
                    this.log(`[${id}] Command timeout`);

                    observer.error();
                  });
              });
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
                  socket.disconnect();
                  socket.connect();
                }),
                first(),
                mapTo(null),
              );
            }),
            take(1),
          );
        }),
      );
    };
  }
}
