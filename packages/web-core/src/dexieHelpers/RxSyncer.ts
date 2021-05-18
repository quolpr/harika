import type {
  ApplyRemoteChangesFunction,
  ReactiveContinuation,
} from 'dexie-syncable/api';
import type { IDatabaseChange as DexieDatabaseChange } from 'dexie-observable/api';
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  fromEvent,
  merge,
  Observable,
  of,
  Subject,
} from 'rxjs';
import {
  catchError,
  concatMap,
  filter,
  first,
  map,
  mapTo,
  mergeMap,
  retry,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
  timeout,
} from 'rxjs/operators';
import { v4 } from 'uuid';
import {
  ApplyNewChangesFromServer,
  CommandFromClientHandled,
  CommandsFromClient,
  CommandTypesFromClient,
  CommandTypesFromServer,
  EventTypesFromServer,
  IDatabaseChange,
  MessageType,
} from '@harika/core';

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export class RxSyncer {
  private socket$: Observable<SocketIOClient.Socket>;

  private clientCommandsSubject: Subject<CommandsFromClient> = new Subject();

  private successCommandHandled$: Subject<CommandFromClientHandled> =
    new Subject();

  private changesFromServer$: Observable<ApplyNewChangesFromServer>;

  private stop$: Subject<void> = new Subject();
  private isConnected$: Observable<boolean>;
  private isInitialized$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);
  private isConnectedAndInitialized$: Observable<boolean>;

  constructor(
    private gatewayName: string,
    private socket: SocketIOClient.Socket,
    private scopeId: string,
    private identity: string,
    private syncedRevision: number,
  ) {
    this.socket$ = of(socket);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window[gatewayName] = socket;

    const connect$ = this.socket$.pipe(
      takeUntil(this.stop$),
      switchMap((socket) => fromEvent(socket, 'connect')),
    );

    const disconnect$ = this.socket$.pipe(
      takeUntil(this.stop$),
      mergeMap((socket) => fromEvent(socket, 'disconnect')),
    );

    this.isConnected$ = merge(
      connect$.pipe(mapTo(true)),
      disconnect$.pipe(mapTo(false)),
    ).pipe(shareReplay());

    this.isConnectedAndInitialized$ = combineLatest([
      this.isConnected$,
      this.isInitialized$,
    ]).pipe(
      map(([isConnected, isInitialized]) => isConnected && isInitialized),
    );

    this.changesFromServer$ = this.isConnected$.pipe(
      switchMap((isConnected) =>
        isConnected
          ? fromEvent<ApplyNewChangesFromServer>(
              socket,
              CommandTypesFromServer.ApplyNewChanges,
            )
          : of<ApplyNewChangesFromServer>(),
      ),
    );

    this.startCommandFlow();
  }

  initialize(
    // First time sync
    changes: IDatabaseChange[],
    baseRevision: number,
    partial: boolean,
    onChangesAccepted: () => void,

    applyRemoteChanges: ApplyRemoteChangesFunction,
    onSuccess: (continuation: ReactiveContinuation) => void,
  ) {
    let isFirstRound = true;
    let wasFirstChangesSent = false;

    const sendFirstChanges = () => {
      if (wasFirstChangesSent) {
        return of(null);
      } else {
        if (changes.length === 0) {
          return of(null).pipe(
            tap(() => {
              console.log('On changes accepted');
              onChangesAccepted();
              wasFirstChangesSent = true;
            }),
          );
        }

        return of(null).pipe(
          this.sendCommand({
            type: CommandTypesFromClient.ApplyNewChanges,
            changes: changes,
            partial: partial,
            baseRevision: baseRevision,
          }),
          tap(() => {
            console.log('On changes accepted');
            onChangesAccepted();
            wasFirstChangesSent = true;
          }),
        );
      }
    };

    this.changesFromServer$.subscribe(
      ({ currentRevision, partial, changes }) => {
        console.log(`[${this.gatewayName}] New changes from server`, {
          currentRevision,
          partial,
          changes,
        });

        applyRemoteChanges(
          changes as unknown as DexieDatabaseChange[],
          currentRevision,
          partial,
        );

        this.syncedRevision = currentRevision;

        if (isFirstRound && !partial) {
          isFirstRound = false;

          console.log('onSuccess');
          onSuccess({
            react: this.handleNewClientChanges,
            disconnect: () => {
              this.stop$.next();
              this.socket.close();
            },
          });
        }
      },
    );

    this.isConnected$
      .pipe(
        switchMap((isConnected) => {
          return isConnected
            ? of(isConnected).pipe(
                this.sendCommand({
                  type: CommandTypesFromClient.InitializeClient,
                  identity: this.identity,
                  scopeId: this.scopeId,
                }),
                switchMap(sendFirstChanges),
                this.sendCommand({
                  type: CommandTypesFromClient.SubscribeClientToChanges,
                  syncedRevision: this.syncedRevision,
                }),
                mapTo(true),
              )
            : of(false);
        }),
      )
      .subscribe((isInitialized) => this.isInitialized$.next(isInitialized));
  }

  private handleNewClientChanges = (
    changes: DexieDatabaseChange[],
    baseRevision: number,
    partial: boolean,
    onChangesAccepted: () => void,
  ) => {
    console.log('handleNewClientChanges', { changes });

    this.isConnectedAndInitialized$
      .pipe(
        switchMap((isConnected) =>
          isConnected
            ? of(null).pipe(
                this.sendCommand({
                  type: CommandTypesFromClient.ApplyNewChanges,
                  changes: changes as unknown as IDatabaseChange[],
                  partial: partial,
                  baseRevision: baseRevision,
                }),
              )
            : of(),
        ),
        first(),
      )
      .subscribe(() => onChangesAccepted());
  };

  private sendCommand(
    command: DistributiveOmit<CommandsFromClient, 'id' | 'messageType'>,
  ) {
    return <T>(source: Observable<T>) => {
      return source.pipe(
        switchMap((val) =>
          of(val).pipe(
            map(() => {
              const messageId = v4();

              this.clientCommandsSubject.next({
                ...command,
                id: messageId,
                messageType: MessageType.Command,
              });

              console.log(
                `[${this.gatewayName}] New command to server!`,
                command,
              );

              return messageId;
            }),
            switchMap((messageId) =>
              this.successCommandHandled$.pipe(
                filter((res) => res.handledId === messageId),
                first(),
                tap(() => {
                  console.log(
                    `[${this.gatewayName}] Command handled by server!`,
                    command,
                  );
                }),
              ),
            ),
            timeout(5000),
            retry(3),
            catchError(() => {
              console.error(
                `[${this.gatewayName}] Failed to send command. Reconnecting`,
                command,
              );

              this.socket.disconnect();
              this.socket.connect();

              return EMPTY;
            }),
          ),
        ),
      );
    };
  }

  private startCommandFlow() {
    const onRequestHandled$ = this.isConnected$.pipe(
      switchMap((isConnected) =>
        isConnected
          ? fromEvent<CommandFromClientHandled>(
              this.socket,
              EventTypesFromServer.CommandHandled,
            )
          : of<CommandFromClientHandled>(),
      ),
    );

    const clientCommandsHandler$ = this.clientCommandsSubject.pipe(
      concatMap((command) => {
        this.socket.emit(command.type, command);

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
          return isConnected
            ? clientCommandsHandler$
            : of<CommandFromClientHandled>();
        }),
      )
      .subscribe((ev) => this.successCommandHandled$.next(ev));
  }
}
