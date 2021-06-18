import { Dexie, liveQuery, Table } from 'dexie';
import io from 'socket.io-client';
import { v4 } from 'uuid';
import {
  BehaviorSubject,
  combineLatest,
  from,
  fromEvent,
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
  NewChangesReceived,
  IDeleteChange,
  ICreateChange,
  IUpdateChange,
} from '@harika/common';
import { isEqual, maxBy, omit } from 'lodash-es';

// table _syncStatus
interface ISyncStatus {
  id: 1;
  lastReceivedRemoteRevision: number | null;
  lastAppliedRemoteRevision: number | null;
  source: string;
}

type IChangeRow = DistributiveOmit<IDatabaseChange, 'source'>;
type IChangeRowWithRev = IChangeRow & {
  rev: string;
};

interface IServerChangesRow {
  id: string;
  change: IDatabaseChange;
  receivedAtRevisionOfServer: number;
}

function bulkUpdate(table: Table, changes: IUpdateChange[]) {
  let keys = changes.map((c) => c.key);
  let map: Record<string, any> = {};
  // Retrieve current object of each change to update and map each
  // found object's primary key to the existing object:
  return table
    .where(':id')
    .anyOf(keys)
    .raw()
    .each((obj, cursor) => {
      map[cursor.primaryKey + ''] = obj;
    })
    .then(() => {
      // Filter away changes whose key wasn't found in the local database
      // (we can't update them if we do not know the existing values)
      let updatesThatApply = changes.filter((c) =>
        map.hasOwnProperty(c.key + ''),
      );
      // Apply modifications onto each existing object (in memory)
      // and generate array of resulting objects to put using bulkPut():
      let objsToPut = updatesThatApply.map((c) => {
        let curr = map[c.key + ''];
        Object.keys(c.mods).forEach((keyPath) => {
          Dexie.setByKeyPath(curr, keyPath, c.mods[keyPath]);
        });
        return curr;
      });

      return table.bulkPut(objsToPut);
    });
}

const trackAndLogChanges = (db: Dexie) => {
  const changesSubject = new Subject<IChangeRow>();

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
              const source = (Dexie.currentTransaction as any).source;

              if (source !== 'serverChanges') {
                if (tableName[0] !== '_' && req.type === 'put') {
                  (
                    await db
                      .table(tableName)
                      .bulkGet(req.values.map(({ id }) => id))
                  ).forEach((obj) => {
                    if (obj) {
                      oldObjects[obj.id] = obj;
                    }
                  });
                }
              }

              const res = await downlevelTable.mutate(req);

              if (source !== 'serverChanges') {
                if (tableName[0] !== '_') {
                  if (req.type === 'add') {
                    req.values.forEach((val) => {
                      changesSubject.next({
                        type: DatabaseChangeType.Create,
                        table: tableName,
                        key: val.id,
                        obj: val,
                      });
                    });
                  }

                  if (req.type === 'delete') {
                    req.keys.forEach((id) => {
                      changesSubject.next({
                        table: tableName,
                        type: DatabaseChangeType.Delete,
                        key: id,
                      });
                    });
                  }

                  if (req.type === 'put') {
                    req.values.forEach((obj) => {
                      if (oldObjects[obj.id]) {
                        changesSubject.next({
                          table: tableName,
                          type: DatabaseChangeType.Update,
                          obj,
                          oldObj: oldObjects[obj.id] as Record<string, unknown>,
                          mods: {},
                          key: obj.id,
                        });
                      } else {
                        changesSubject.next({
                          table: tableName,
                          type: DatabaseChangeType.Create,
                          obj: obj,
                          key: obj.id,
                        });
                      }
                    });
                  }
                }
              }

              return res;
            },
          };
        },
      };
    },
  });

  changesSubject
    .pipe(
      buffer(changesSubject.pipe(debounceTime(100))),
      concatMap(async (rawChanges) => {
        let changes = rawChanges.map((change): DistributiveOmit<
          IDatabaseChange,
          'source'
        > => {
          if (change.type === DatabaseChangeType.Update) {
            return omit(
              {
                ...change,
                mods: (Dexie as any).getObjectDiff(change.oldObj, change.obj),
              },
              ['oldObj', 'obj'],
            );
          }

          return change;
        });

        await db.table('_changesToSend').bulkAdd(changes);
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

    this.isConnected$.subscribe((isConnected) => {
      console.log({ isConnected });
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
        let currentStatus = await syncStatusTable.get(1);

        if (!currentStatus) {
          currentStatus = {
            id: 1,
            lastReceivedRemoteRevision: null,
            lastAppliedRemoteRevision: null,
            source: v4(),
          };

          syncStatusTable.put(currentStatus);
        }

        return currentStatus;
      }),
    );

    from(
      liveQuery(() =>
        this.db.table<ISyncStatus>('_syncStatus').get(1),
      ) as Observable<ISyncStatus>,
    )
      .pipe(filter((val) => val && !isEqual(val, this.syncStatusSubject.value)))
      .subscribe((newStatus) => {
        this.syncStatusSubject.next(newStatus);
        console.log('new status!', newStatus);
      });

    this.initializeOnConnectPipe().subscribe((isInitialized) => {
      this.isInitialized$.next(isInitialized);
    });

    this.isConnectedAndInitialized$
      .pipe(
        switchMap((isConnectedAndInitialized) => {
          if (isConnectedAndInitialized) {
            return merge(
              this.changesSenderPipe(),
              this.receiveServerChangesPipe(),
            );
          } else {
            return of(null);
          }
        }),
      )
      .subscribe();

    this.applyServerChangesPipe().subscribe();
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
    const changesTable = this.db.table<IChangeRowWithRev>('_changesToSend');

    return from(
      liveQuery(() => changesTable.toArray()) as Observable<
        IChangeRowWithRev[]
      >,
    ).pipe(
      filter((changes) => changes.length > 0),
      exhaustMap((mutations) => {
        return of(null).pipe(
          this.sendCommand(() => {
            const syncStatus = this.syncStatusSubject.value;

            return {
              type: CommandTypesFromClient.ApplyNewChanges,
              changes: mutations.map((mutation) => ({
                ...mutation,
                source: syncStatus.source,
              })),
              partial: false,
              baseRevision: syncStatus.lastAppliedRemoteRevision,
            };
          }),
          switchMap(async () => {
            await this.db.transaction('rw', [changesTable], () =>
              changesTable.bulkDelete(mutations.map(({ rev }) => rev)),
            );
          }),
        );
      }),
    );
  }

  private applyServerChangesPipe() {
    const changesToSendTable = this.db.table<IChangeRow>('_changesToSend');
    const serverChangesToApplyTable =
      this.db.table<IChangeRow>('_changesFromServer');

    return combineLatest([
      liveQuery(() => changesToSendTable.count()) as Observable<number>,
      liveQuery(() => serverChangesToApplyTable.toArray()) as Observable<
        IServerChangesRow[]
      >,
    ]).pipe(
      filter(([count, changeRows]) => count === 0 && changeRows.length !== 0),
      exhaustMap(([, changeRows]) => {
        let collectedChanges: Record<
          string,
          {
            [DatabaseChangeType.Create]: ICreateChange[];
            [DatabaseChangeType.Delete]: IDeleteChange[];
            [DatabaseChangeType.Update]: IUpdateChange[];
          }
        > = {};

        changeRows.forEach((row) => {
          if (!collectedChanges.hasOwnProperty(row.change.table)) {
            collectedChanges[row.change.table] = {
              [DatabaseChangeType.Create]: [],
              [DatabaseChangeType.Delete]: [],
              [DatabaseChangeType.Update]: [],
            };
          }
          collectedChanges[row.change.table][row.change.type].push(
            row.change as any,
          );
        });

        let table_names = Object.keys(collectedChanges);
        let tables = table_names.map((table) => this.db.table(table));

        const maxRevision = maxBy(
          changeRows,
          ({ receivedAtRevisionOfServer }) => receivedAtRevisionOfServer,
        )?.receivedAtRevisionOfServer;

        if (maxRevision === undefined)
          throw new Error('Max revision could not be undefined');

        return this.db.transaction(
          'rw',
          [...tables, this.db.table('_syncStatus')],
          () => {
            table_names.forEach((table_name) => {
              // @ts-ignore
              Dexie.currentTransaction.source = 'serverChanges';

              const table = this.db.table(table_name);
              const specifyKeys = !table.schema.primKey.keyPath;
              const createChangesToApply =
                collectedChanges[table_name][DatabaseChangeType.Create];
              const deleteChangesToApply =
                collectedChanges[table_name][DatabaseChangeType.Delete];
              const updateChangesToApply =
                collectedChanges[table_name][DatabaseChangeType.Update];
              if (createChangesToApply.length > 0)
                table.bulkPut(
                  createChangesToApply.map((c) => c.obj),
                  specifyKeys
                    ? createChangesToApply.map((c) => c.key)
                    : undefined,
                );
              if (updateChangesToApply.length > 0)
                bulkUpdate(table, updateChangesToApply);
              if (deleteChangesToApply.length > 0)
                table.bulkDelete(deleteChangesToApply.map((c) => c.key));
            });

            this.db.table<ISyncStatus>('_syncStatus').update(1, {
              lastAppliedRemoteRevision: maxRevision,
            });
          },
        );
      }),
    );
  }

  private receiveServerChangesPipe() {
    // const changesTable = this.db.table<Mutation>('_changesToSend');

    // // TODO: maybe add block to mobx -> dexie sync while applying changes from server
    // const receiveChangesPipe = (isFinishedSubject: Subject<unknown>) => {
    //   return of(null).pipe(
    //     this.sendCommand(() => ({
    //       type: CommandTypesFromClient.GetChanges,
    //       lastReceivedRemoteRevision:
    //         this.syncStatusSubject.value.lastReceivedRemoteRevision,
    //     })),
    //     filter(<T>(x: T | null): x is T => x !== null),

    //     tap((res) => {
    //       console.log('new changes handled!');
    //       isFinishedSubject.next(null);
    //     }),
    //   );
    // };

    return merge(
      of(null),
      this.socket$.pipe(
        switchMap((socket) =>
          fromEvent<NewChangesReceived>(
            socket,
            EventTypesFromServer.NewChangesReceived,
          ),
        ),
      ),
    ).pipe(
      this.sendCommand(() => ({
        type: CommandTypesFromClient.GetChanges,
        lastReceivedRemoteRevision:
          this.syncStatusSubject.value.lastReceivedRemoteRevision,
      })),
      filter(<T>(x: T | null): x is T => x !== null),
      tap((res) => {
        if (res.type !== EventTypesFromServer.CommandHandled)
          throw new Error('error');
        if (!res.data) throw new Error('error');

        const { data } = res;

        this.db.transaction('rw', ['_syncStatus', '_changesFromServer'], () => {
          console.log({ currentRevision: data.currentRevision });
          this.db.table<ISyncStatus>('_syncStatus').update(1, {
            lastReceivedRemoteRevision: data.currentRevision,
          });

          if (data.changes.length !== 0) {
            this.db.table<IServerChangesRow>('_changesFromServer').bulkAdd(
              data.changes.map((ch) => ({
                id: v4(),
                change: ch,
                receivedAtRevisionOfServer: data.currentRevision,
              })),
            );
          }
        });
      }),
    );

    // // TODO: handle also event from server that new changes are handled by server
    // return interval(1000).pipe(
    //   exhaustMap(() => {
    //     const isFinishedSubject = new Subject();

    //     return from(
    //       liveQuery(() => changesTable.count()) as Observable<number>,
    //     ).pipe(
    //       switchMap((mutationsCount) => {
    //         if (mutationsCount > 0) return of(mutationsCount);

    //         console.log('requesting changes from server!');

    //         return receiveChangesPipe(isFinishedSubject);
    //       }),
    //       takeUntil(isFinishedSubject),
    //     );
    //   }),
    // );
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

  private log(msg: string) {
    console.debug(`[${this.gatewayName}][${this.scopeId}] ${msg}`);
  }
}

export const setupServerSync = (db: VaultDexieDatabase, url: string) => {
  trackAndLogChanges(db);

  const syncer = new ServerSync(db, 'vault', db.id, `${url}/api/vault`);

  syncer.initialize();
};