import { Dexie, liveQuery } from 'dexie';
import io from 'socket.io-client';
import { v4 } from 'uuid';
import {
  BehaviorSubject,
  combineLatest,
  from,
  fromEvent,
  interval,
  merge,
  Subject,
  Observable,
  of,
  EMPTY,
} from 'rxjs';
import {
  buffer,
  catchError,
  concatMap,
  debounceTime,
  delay,
  exhaustMap,
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
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';
import type { VaultDexieDatabase } from '../NotesRepository/dexieDb/DexieDb';
import {
  CommandsFromClient,
  MessageType,
  CommandFromClientHandled,
  EventTypesFromServer,
  CommandTypesFromClient,
  IDatabaseChange,
  DatabaseChangeType,
} from '@harika/common';

// table _syncStatus
interface ISyncStatus {
  lastReceivedRemoteRevision: number | null;
  source: string;
}

enum OperationType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

type CreateMutation = {
  type: OperationType.Create;
  table: string;
  obj: { [keyPath: string]: any };
  rev: number;
};
type UpdateMutation = {
  type: OperationType.Update;
  table: string;
  diff: { [keyPath: string]: any };
  oldObj: { [keyPath: string]: any };
  rev: number;
};

type DeleteMutation = {
  type: OperationType.Delete;
  table: string;
  id: string;
  rev: number;
};

type RawCreateMutation = Omit<CreateMutation, 'rev'>;
type RawUpdateMutation = {
  type: OperationType.Update;
  table: string;
  oldObj: { [keyPath: string]: any };
  partialObj: { [keyPath: string]: any };
};
type RawDeleteMutation = Omit<DeleteMutation, 'rev'>;

type RawMutation = RawCreateMutation | RawUpdateMutation | RawDeleteMutation;
type Mutation = CreateMutation | UpdateMutation | DeleteMutation;

const mutationToDatabaseChange = (
  mutation: Mutation,
  source: string,
): IDatabaseChange => {
  if (mutation.type === OperationType.Create) {
    return {
      type: DatabaseChangeType.Create,
      table: mutation.table,
      key: mutation.obj.id,
      obj: mutation.obj,
      source,
    };
  } else if (mutation.type === OperationType.Update) {
    return {
      type: DatabaseChangeType.Update,
      table: mutation.table,
      key: mutation.oldObj.id,
      oldObj: mutation.oldObj,
      mods: mutation.diff,
      source,
    };
  } else {
    return {
      type: DatabaseChangeType.Delete,
      table: mutation.table,
      key: mutation.id,
      source,
    };
  }
};

const trackAndLogMutations = (db: Dexie) => {
  const mutatesSubject = new Subject<RawMutation>();

  db.use({
    stack: 'dbcore', // The only stack supported so far.
    name: 'SyncMiddleware', // Optional name of your middleware
    create(downlevelDatabase) {
      // Return your own implementation of DBCore:
      return {
        // Copy default implementation.
        ...downlevelDatabase,
        // Override table method
        table(tableName) {
          // Call default table method
          const downlevelTable = downlevelDatabase.table(tableName);
          // Derive your own table from it:
          return {
            // Copy default table implementation:
            ...downlevelTable,
            // Override the mutate method:
            mutate: async (req) => {
              let oldObjects: Record<string, object> = {};

              if (tableName[0] !== '_' && req.type === 'put') {
                (
                  await db
                    .table(tableName)
                    .bulkGet(req.values.map(({ id }) => id))
                ).forEach((obj) => {
                  oldObjects[obj.id] = obj;
                });
              }

              const res = await downlevelTable.mutate(req);

              if (tableName[0] !== '_') {
                if (req.type === 'add') {
                  req.values.forEach((val) => {
                    mutatesSubject.next({
                      table: tableName,
                      type: OperationType.Create,
                      obj: val,
                    });
                  });
                }

                if (req.type === 'delete') {
                  req.keys.forEach((id) => {
                    mutatesSubject.next({
                      table: tableName,
                      type: OperationType.Delete,
                      id,
                    });
                  });
                }

                if (req.type === 'put') {
                  req.values.forEach((obj) => {
                    mutatesSubject.next({
                      table: tableName,
                      type: OperationType.Update,
                      oldObj: oldObjects[obj.id],
                      partialObj: obj,
                    });
                  });
                }
              }

              return res;
            },
          };
        },
      };
    },
  });

  mutatesSubject
    .pipe(
      buffer(mutatesSubject.pipe(debounceTime(100))),
      concatMap(async (rawMutations) => {
        let mutations = rawMutations.map((mutation): Mutation => {
          if (mutation.type === OperationType.Update) {
            return {
              type: OperationType.Update,
              table: mutation.table,
              // this method exists in Dexie
              diff: (Dexie as any).getObjectDiff(
                mutation.oldObj,
                mutation.partialObj,
              ),
              oldObj: mutation.oldObj,
            } as Mutation;
          }

          return mutation as Mutation;
        });

        await db.table('_changesToSend').bulkAdd(mutations);
      }),
    )
    .subscribe();
};

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

class ServerSync {
  private clientCommandsSubject: Subject<CommandsFromClient> = new Subject();
  private successCommandHandled$: Subject<CommandFromClientHandled> =
    new Subject();
  private isConnectedAndInitialized$: Observable<boolean>;
  private isSyncLeader$ = new BehaviorSubject(false);
  private socketSubject = new Subject<SocketIOClient.Socket>();
  private socket$ = this.socketSubject.pipe(
    shareReplay({
      bufferSize: 1,
      refCount: true,
    }),
  );
  private isConnected$: Observable<boolean>;
  private stop$: Subject<void> = new Subject();
  private isInitialized$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);
  private syncStatusSubject!: BehaviorSubject<ISyncStatus>;

  constructor(
    private db: Dexie,
    private gatewayName: string,
    private scopeId: string,
    private url: string,
  ) {
    this.connectWhenElected();

    const connect$ = this.socket$.pipe(
      switchMap((socket) => fromEvent(socket, 'connect')),
    );

    const disconnect$ = this.socket$.pipe(
      mergeMap((socket) => fromEvent(socket, 'disconnect')),
    );

    this.isConnected$ = merge(
      connect$.pipe(mapTo(true)),
      disconnect$.pipe(mapTo(false)),
    ).pipe(
      takeUntil(this.stop$),
      shareReplay({
        refCount: true,
      }),
    );

    this.isConnected$.subscribe(() => {
      console.log('is connected!');
    });

    this.isConnectedAndInitialized$ = combineLatest([
      this.isConnected$,
      this.isInitialized$,
    ]).pipe(
      map(([isConnected, isInitialized]) => isConnected && isInitialized),
    );
  }

  async initialize() {
    this.startCommandFlow();

    this.syncStatusSubject = new BehaviorSubject(
      await this.db.transaction('rw', '_syncStatus', async () => {
        const syncStatusTable = this.db.table<ISyncStatus>('_syncStatus');
        let currentStatus = (await syncStatusTable.toArray())[0];

        if (!currentStatus) {
          currentStatus = {
            lastReceivedRemoteRevision: null,
            source: v4(),
          };
          syncStatusTable.put(currentStatus);
        }

        return currentStatus;
      }),
    );

    this.initializeOnConnectPipe().subscribe((isInitialized) => {
      this.isInitialized$.next(isInitialized);
    });
    this.changesSenderPipe().subscribe();
  }

  private initializeOnConnectPipe() {
    return this.isConnected$.pipe(
      switchMap((isConnected) => {
        if (isConnected) {
          return of(null).pipe(
            this.sendCommand(() => ({
              type: CommandTypesFromClient.InitializeClient,
              identity: this.syncStatusSubject.value.source,
              scopeId: this.scopeId,
            })),
            mapTo(true),
          );
        } else {
          return of(false);
        }
      }),
      takeUntil(this.stop$),
    );
  }

  private connectWhenElected() {
    const channel = new BroadcastChannel('dexieSync');
    // TODO: what to do with leader duplication?
    const elector = createLeaderElection(channel);

    elector
      .awaitLeadership()
      .then(() =>
        this.socketSubject.next(io(this.url, { transports: ['websocket'] })),
      );
  }

  private changesSenderPipe() {
    const changesTable = this.db.table<Mutation>('_changesToSend');

    return this.isConnectedAndInitialized$.pipe(
      switchMap((isConnectedAndInitialized) => {
        return isConnectedAndInitialized
          ? from(
              liveQuery(() => changesTable.toArray()) as Observable<Mutation[]>,
            ).pipe(
              filter((mutations) => mutations.length > 0),
              exhaustMap((mutations) => {
                return of(null).pipe(
                  this.sendCommand(() => {
                    const syncStatus = this.syncStatusSubject.value;

                    return {
                      type: CommandTypesFromClient.ApplyNewChanges,
                      changes: mutations.map((mutation) =>
                        mutationToDatabaseChange(mutation, syncStatus.source),
                      ),
                      partial: false,
                      baseRevision: syncStatus.lastReceivedRemoteRevision,
                    };
                  }),
                  switchMap(async () => {
                    await changesTable.bulkDelete(
                      mutations.map(({ rev }) => rev),
                    );
                  }),
                );
              }),
            )
          : of(null);
      }),
    );
  }

  private sendCommand<T>(
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
                mapTo(val),
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

export const setupServerSync = (db: VaultDexieDatabase, url: string) => {
  trackAndLogMutations(db);

  const syncer = new ServerSync(db, 'vault', db.id, `${url}/api/vault`);

  syncer.initialize();
};
