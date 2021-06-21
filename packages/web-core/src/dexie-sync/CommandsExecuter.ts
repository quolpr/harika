import { v4 } from 'uuid';
import { combineLatest, fromEvent, Subject, Observable, of, EMPTY } from 'rxjs';
import {
  catchError,
  filter,
  first,
  map,
  mapTo,
  mergeMap,
  retry,
  switchMap,
  takeUntil,
  tap,
  timeout,
} from 'rxjs/operators';
import {
  CommandsFromClient,
  MessageType,
  CommandFromClientHandled,
  EventTypesFromServer,
} from '@harika/common';

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export class CommandsExecuter {
  private clientCommandsSubject: Subject<CommandsFromClient> = new Subject();
  private successCommandHandled$: Subject<CommandFromClientHandled> =
    new Subject();

  constructor(
    private log: (str: string) => void,
    private socket$: Observable<SocketIOClient.Socket>,
    private isConnected$: Observable<boolean>,
    private stop$: Subject<void>,
  ) {}

  send<T>(
    commandFunction: (
      val: T,
    ) => DistributiveOmit<CommandsFromClient, 'id' | 'messageType'>,
  ) {
    return (source: Observable<T>) => {
      return source.pipe(
        switchMap((val) => {
          const command = commandFunction(val);

          return of(val).pipe(
            map(() => {
              const messageId = v4();

              this.clientCommandsSubject.next({
                ...command,
                id: messageId,
                messageType: MessageType.Command,
              });

              this.log(
                `New command to server: ${JSON.stringify(
                  command,
                )} ${messageId}`,
              );

              return messageId;
            }),
            switchMap((messageId) =>
              this.successCommandHandled$.pipe(
                filter((res) => res.handledId === messageId),
                first(),
                tap(() => {
                  this.log(
                    `Command handled by server: ${JSON.stringify(command)}`,
                  );
                }),
              ),
            ),
            timeout(5000),
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
                mapTo(val),
              );
            }),
          );
        }),
      );
    };
  }

  start() {
    const onRequestHandled$ = combineLatest([
      this.isConnected$,
      this.socket$,
    ]).pipe(
      switchMap(([isConnected, socket]) =>
        isConnected
          ? fromEvent<CommandFromClientHandled>(
              socket,
              EventTypesFromServer.CommandHandled,
            )
          : EMPTY,
      ),
    );

    const clientCommandsHandler$ = combineLatest([
      this.clientCommandsSubject,
      this.socket$,
    ]).pipe(
      mergeMap(([command, socket]) => {
        socket.emit(command.type, command);

        return onRequestHandled$.pipe(
          filter(
            (response) =>
              command.id === response.handledId && response.status === 'ok',
          ),
          first(),
        );
      }),
    );

    this.isConnected$
      .pipe(
        switchMap((isConnected) => {
          return isConnected ? clientCommandsHandler$ : EMPTY;
        }),
        takeUntil(this.stop$),
      )
      .subscribe((ev) => this.successCommandHandled$.next(ev));
  }
}
