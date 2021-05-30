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
  Subject,
} from 'rxjs';
import {
  catchError,
  concatMap,
  delay,
  distinctUntilChanged,
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
      switchMap((socket) => fromEvent(socket, 'connect')),
    );

    const disconnect$ = this.socket$.pipe(
      mergeMap((socket) => fromEvent(socket, 'disconnect')),
    );

    this.isConnected$ = merge(
      connect$.pipe(mapTo(true)),
      disconnect$.pipe(mapTo(false)),
    ).pipe(takeUntil(this.stop$), shareReplay());

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
      takeUntil(this.stop$),
      shareReplay(1),
    );

    this.isMaster$.subscribe((isMaster) => {
      this.log(isMaster ? 'Master' : 'Not master');
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
        catchError((err: unknown) => {
          return of(null);
        }),
        tap(() => this.isLocked$.next(false)),
        takeUntil(this.stop$),
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

          this.log(
            `New changes from server: ${JSON.stringify(changesDescription)}`,
          );

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
        takeUntil(this.stop$),
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
              this.log('On changes accepted');
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
            this.log('On changes accepted');
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
        takeUntil(this.stop$),
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
        takeUntil(this.stop$),
      )
      .subscribe({
        next: () => {
          this.log(`Changes are sent to server: ${JSON.stringify(changes)}`);

          onChangesAccepted();
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

              this.log(`New command to server: ${JSON.stringify(command)}`);

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
        takeUntil(this.stop$),
      )
      .subscribe((ev) => this.successCommandHandled$.next(ev));
  }

  private log(msg: string) {
    console.debug(`[${this.gatewayName}][${this.scopeId}] ${msg}`);
  }
}
