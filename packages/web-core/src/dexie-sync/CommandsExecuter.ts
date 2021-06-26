import { v4 } from 'uuid';
import {
  combineLatest,
  fromEvent,
  Subject,
  Observable,
  of,
  EMPTY,
  merge,
} from 'rxjs';
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
  MessageType,
  BaseCommandRequest,
  BaseCommandResponse,
  ClientCommandRequests,
  ClientCommandResponses,
  CommandTypesFromClient,
  ClientCommands,
} from '@harika/common';

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export class CommandsExecuter {
  private clientCommandsSubject: Subject<ClientCommandRequests> = new Subject();
  private commandHandled$: Subject<ClientCommandResponses> = new Subject();

  constructor(
    private socket$: Observable<SocketIOClient.Socket>,
    private isConnected$: Observable<boolean>,
    private log: (str: string) => void,
    private stop$: Subject<void>,
  ) {}

  send<T extends ClientCommands, K extends unknown = unknown>(
    commandFunction: (
      val: K,
    ) => DistributiveOmit<T['request'], 'messageId' | 'messageType'>,
  ) {
    return (source: Observable<K>) => {
      return source.pipe(
        switchMap((val) => {
          const command = commandFunction(val);

          return of(val).pipe(
            map(() => {
              const messageId = v4();

              this.clientCommandsSubject.next({
                ...command,
                messageId: messageId,
                messageType: MessageType.CommandRequest,
              } as unknown as T['request']); // TODO: not sure why it doesn't work. Should be fixed

              this.log(
                `New command to server: ${JSON.stringify(
                  command,
                  null,
                  2,
                )} ${messageId}`,
              );

              return messageId;
            }),
            switchMap((messageId) =>
              this.commandHandled$.pipe(
                filter((res) => res.requestedMessageId === messageId),
                map((res) => res as T['response']),
                first(),
                tap((res) => {
                  this.log(
                    `Command handled by server: ${JSON.stringify(
                      command,
                      null,
                      2,
                    )}\nres:${JSON.stringify(res, null, 2)}`,
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
                mapTo(null),
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
          ? merge(
              fromEvent<ClientCommandResponses>(
                socket,
                CommandTypesFromClient.GetChanges,
              ),
              fromEvent<ClientCommandResponses>(
                socket,
                CommandTypesFromClient.InitializeClient,
              ),
              fromEvent<ClientCommandResponses>(
                socket,
                CommandTypesFromClient.ApplyNewChanges,
              ),
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
            (response) => command.messageId === response.requestedMessageId,
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
      .subscribe((ev) => this.commandHandled$.next(ev));
  }
}
