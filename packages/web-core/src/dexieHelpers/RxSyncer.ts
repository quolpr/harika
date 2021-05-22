import Dexie from 'dexie';
import 'dexie-observable';
import 'dexie-syncable';
import type {
  ApplyRemoteChangesFunction,
  IPersistedContext,
  ISyncProtocol,
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
  pipe,
  Subject,
} from 'rxjs';
import {
  bufferToggle,
  catchError,
  concatMap,
  delay,
  distinctUntilChanged,
  filter,
  first,
  flatMap,
  map,
  mapTo,
  mergeMap,
  retry,
  shareReplay,
  switchMap,
  take,
  takeUntil,
  tap,
  timeout,
  withLatestFrom,
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
  MasterClientWasSet,
  MessageType,
} from '@harika/common';
import io from 'socket.io-client';

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export interface IConflictsResolver {
  resolveConflicts(
    changes: Array<{ table: string; key: string }>,
  ): Promise<void>;
}

export class RxSyncer {
  private clientCommandsSubject: Subject<CommandsFromClient> = new Subject();

  private successCommandHandled$: Subject<CommandFromClientHandled> =
    new Subject();

  private changesFromServer$: Observable<ApplyNewChangesFromServer>;

  private stop$: Subject<void> = new Subject();
  private isConnected$: Observable<boolean>;
  private isInitialized$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);
  private isConnectedAndInitialized$: Observable<boolean>;
  private isMaster$: Observable<boolean>;
  private isLocked$ = new BehaviorSubject<boolean>(false);
  private lastChangesFromServer: Array<{ table: string; key: string }> = [];
  private socketSubject = new Subject<SocketIOClient.Socket>();
  private socket$ = this.socketSubject.pipe(shareReplay(1));
  private syncedRevision: number | null = null;
  private identity!: string;

  constructor(
    private db: Dexie,
    private gatewayName: string,
    private scopeId: string,
    url: string,
    private conflictsResolver?: IConflictsResolver,
  ) {
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

    this.changesFromServer$ = combineLatest([
      this.isConnected$,
      this.socket$,
    ]).pipe(
      switchMap(([isConnected, socket]) =>
        isConnected
          ? fromEvent<ApplyNewChangesFromServer>(
              socket,
              CommandTypesFromServer.ApplyNewChanges,
            )
          : EMPTY,
      ),
    );

    this.isMaster$ = combineLatest([this.isConnected$, this.socket$]).pipe(
      switchMap(([isConnected, socket]) => {
        return isConnected
          ? merge(
              fromEvent<MasterClientWasSet>(
                socket,
                EventTypesFromServer.MasterWasSet,
              ).pipe(map((e) => e.identity === this.identity)),
              of(false),
            )
          : of(false);
      }),
      shareReplay(1),
    );

    this.isMaster$.subscribe((isMaster) => {
      console.log(isMaster ? 'Master' : 'Not master');
    });

    const resolveConflict$ = merge(
      this.changesFromServer$,
      this.clientCommandsSubject,
      this.isConnectedAndInitialized$,
      this.isMaster$,
    ).pipe(
      mapTo(false),

      switchMap(() => {
        return of(false).pipe(
          delay(500),
          withLatestFrom(this.isConnectedAndInitialized$, this.isMaster$),
          map(([_, isConnected, isMaster]) => isConnected && isMaster),
        );
      }),
      filter((v) => v),
    );

    resolveConflict$
      .pipe(
        filter(() => !this.isLocked$.value),
        tap(() => this.isLocked$.next(true)),
        switchMap(async () => {
          const lastChangesFromServer = [...this.lastChangesFromServer];

          this.lastChangesFromServer = [];

          await this.conflictsResolver?.resolveConflicts(lastChangesFromServer);
        }),
        catchError((err) => {
          console.error(err);
          return of(null);
        }),
        tap(() => this.isLocked$.next(false)),
      )
      .subscribe();

    this.startCommandFlow();

    const protocolName = `${scopeId}-${gatewayName}`;

    Dexie.Syncable.registerSyncProtocol(protocolName, {
      sync: this.initialize as unknown as ISyncProtocol['sync'],
    });

    db.syncable.connect(protocolName, url);
  }

  initialize = async (
    context: IPersistedContext,
    url: string,
    _options: any,
    baseRevision: number,
    syncedRevision: number,
    changes: IDatabaseChange[],
    partial: boolean,
    applyRemoteChanges: ApplyRemoteChangesFunction,
    onChangesAccepted: () => void,
    onSuccess: (continuation: ReactiveContinuation) => void,
    _onError: (error: any, again?: number) => void,
  ) => {
    this.syncedRevision = syncedRevision;

    if (!context.identity) {
      context.identity = v4();
      await context.save();
    }

    this.identity = context.identity;

    this.socketSubject.next(io(url, { transports: ['websocket'] }));

    let isFirstRound = true;
    let wasFirstChangesSent = false;

    this.changesFromServer$
      .pipe(
        // bufferToggle(this.isLocked$.pipe(filter((v) => !!v)), () =>
        //   this.isLocked$.pipe(filter((v) => !v)),
        // ),
        // mergeMap((v) => v),
        concatMap(async (changesDescription) => {
          const { currentRevision, partial, changes } = changesDescription;

          console.log('new changes from server', changesDescription);

          await applyRemoteChanges(
            changes as unknown as DexieDatabaseChange[],
            currentRevision,
            partial,
          );

          this.lastChangesFromServer.push(
            ...changes.map((ch) => ({ key: ch.key, table: ch.table })),
          );

          this.syncedRevision = currentRevision;

          return changesDescription;
        }),
        switchMap(() => this.socket$),
      )
      .subscribe((socket) => {
        if (isFirstRound && !partial) {
          isFirstRound = false;
          onSuccess({
            react: this.handleNewClientChanges,
            disconnect: () => {
              this.stop$.next();
              socket.close();
            },
          });
        }
      });

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
  };

  private handleNewClientChanges = (
    changes: DexieDatabaseChange[],
    baseRevision: number,
    partial: boolean,
    onChangesAccepted: () => void,
  ) => {
    combineLatest([this.isConnectedAndInitialized$, this.isLocked$])
      .pipe(
        map(([isConnected, isLocked]) => isConnected && !isLocked),
        distinctUntilChanged(),
        switchMap((isGoodToSendChanges) => {
          return isGoodToSendChanges
            ? of(null).pipe(
                this.sendCommand({
                  type: CommandTypesFromClient.ApplyNewChanges,
                  changes: changes as unknown as IDatabaseChange[],
                  partial: partial,
                  baseRevision: baseRevision,
                }),
              )
            : of();
        }),
        first(),
      )
      .subscribe({
        next() {
          console.log('Changes are sent to server', changes);

          onChangesAccepted();
        },
        complete() {
          console.log('completed');
        },
      });
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

              return this.socket$.pipe(
                tap((socket) => {
                  socket.disconnect();
                  socket.connect();
                }),
                first(),
              );
            }),
          ),
        ),
      );
    };
  }

  private startCommandFlow() {
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
      concatMap(([command, socket]) => {
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
      )
      .subscribe((ev) => this.successCommandHandled$.next(ev));
  }
}
