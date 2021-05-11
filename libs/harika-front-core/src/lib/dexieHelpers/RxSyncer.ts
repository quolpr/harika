import {
  ApplyRemoteChangesFunction,
  ReactiveContinuation,
} from 'dexie-syncable/api';
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  fromEvent,
  merge,
  Observable,
  of,
  pipe,
  Subject,
} from 'rxjs';
import {
  concatMap,
  filter,
  first,
  map,
  mapTo,
  mergeMap,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
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
} from '@harika/harika-core';

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export class RxSyncer {
  private socket$: Observable<SocketIOClient.Socket>;

  private clientCommandsSubject: Subject<CommandsFromClient> = new Subject();

  private responseBus$: Subject<CommandFromClientHandled> = new Subject();

  private changesFromServer$: Observable<ApplyNewChangesFromServer>;

  private stop$: Subject<void> = new Subject();
  private isConnected$: Observable<boolean>;
  private isInitialized$: BehaviorSubject<boolean> = new BehaviorSubject<
    boolean
  >(false);
  private isConnectedAndInitialized$: Observable<boolean>;

  constructor(
    private socket: SocketIOClient.Socket,
    private scopeId: string,
    private identity: string
  ) {
    this.socket$ = of(socket);

    const connect$ = this.socket$.pipe(
      takeUntil(this.stop$),
      switchMap((socket) => fromEvent(socket, 'connect'))
    );

    const disconnect$ = this.socket$.pipe(
      takeUntil(this.stop$),
      mergeMap((socket) => fromEvent(socket, 'disconnect'))
    );

    this.isConnected$ = merge(
      connect$.pipe(mapTo(true)),
      disconnect$.pipe(mapTo(false))
    ).pipe(shareReplay());

    this.isConnectedAndInitialized$ = combineLatest([
      this.isConnected$,
      this.isInitialized$,
    ]).pipe(
      map(([isConnected, isInitialized]) => isConnected && isInitialized)
    );

    this.changesFromServer$ = this.isConnected$.pipe(
      switchMap((isConnected) =>
        isConnected
          ? fromEvent<ApplyNewChangesFromServer>(
              socket,
              CommandTypesFromServer.ApplyNewChanges
            )
          : of<ApplyNewChangesFromServer>()
      )
    );

    this.startCommandFlow();
  }

  initialize(
    // First time sync
    changes: IDatabaseChange[],
    baseRevision: number,
    partial: boolean,
    onChangesAccepted: () => void,

    syncedRevision: number,
    applyRemoteChanges: ApplyRemoteChangesFunction,
    onSuccess: (continuation: ReactiveContinuation) => void
  ) {
    let isFirstRound = true;
    let wasFirstChangesSent = false;

    const sendFirstChanges = () => {
      if (wasFirstChangesSent) {
        return EMPTY;
      } else {
        return EMPTY.pipe(
          this.sendCommand({
            type: CommandTypesFromClient.ApplyNewChanges,
            changes: changes,
            partial: partial,
            baseRevision: baseRevision,
          }),
          tap(() => {
            onChangesAccepted();
            wasFirstChangesSent = true;
          })
        );
      }
    };

    this.changesFromServer$.subscribe(
      ({ currentRevision, partial, changes }) => {
        applyRemoteChanges(changes, currentRevision, partial);

        if (isFirstRound && !partial) {
          isFirstRound = false;

          onSuccess({
            react: this.handleNewClientChanges,
            disconnect: () => {
              this.stop$.next();
              this.socket.close();
            },
          });
        }
      }
    );

    this.isConnected$
      .pipe(
        switchMap((isConnected) => {
          console.log({ isConnected });
          return isConnected
            ? EMPTY.pipe(
                this.sendCommand({
                  type: CommandTypesFromClient.InitializeClient,
                  identity: this.identity,
                  scopeId: this.scopeId,
                }),
                switchMap(sendFirstChanges),
                this.sendCommand({
                  type: CommandTypesFromClient.SubscribeClientToChanges,
                  syncedRevision,
                }),
                mapTo(true)
              )
            : of(false);
        })
      )
      .subscribe((isInitialized) => this.isInitialized$.next(isInitialized));
  }

  private handleNewClientChanges = (
    changes: IDatabaseChange[],
    baseRevision: number,
    partial: boolean,
    onChangesAccepted: () => void
  ) => {
    this.isConnectedAndInitialized$
      .pipe(
        switchMap((isConnected) =>
          isConnected
            ? pipe(
                this.sendCommand({
                  type: CommandTypesFromClient.ApplyNewChanges,
                  changes: changes as IDatabaseChange[],
                  partial: partial,
                  baseRevision: baseRevision,
                })
              )
            : of()
        ),
        first()
      )
      .subscribe(() => onChangesAccepted());
  };

  private sendCommand(
    command: DistributiveOmit<CommandsFromClient, 'id' | 'messageType'>
  ) {
    return <T>(source: Observable<T>) => {
      const requestId = v4();

      this.clientCommandsSubject.next({
        ...command,
        id: v4(),
        messageType: MessageType.Command,
      });

      return source.pipe(
        switchMap(() =>
          this.responseBus$.pipe(
            filter((res) => res.handledId === requestId),
            first()
          )
        )
      );
    };
  }

  private startCommandFlow() {
    const onRequestHandled$ = this.isConnected$.pipe(
      switchMap((isConnected) =>
        isConnected
          ? fromEvent<CommandFromClientHandled>(
              this.socket,
              EventTypesFromServer.CommandHandled
            )
          : of<CommandFromClientHandled>()
      )
    );

    const clientCommandsHandler$ = this.clientCommandsSubject.pipe(
      concatMap((command) => {
        this.socket.emit(command.type, command);

        return onRequestHandled$.pipe(
          filter((response) => command.id === response.handledId),
          first()
        );
      })
    );

    this.isConnected$
      .pipe(
        switchMap((isConnected) => {
          return isConnected
            ? clientCommandsHandler$
            : of<CommandFromClientHandled>();
        })
      )
      .subscribe();
  }
}
