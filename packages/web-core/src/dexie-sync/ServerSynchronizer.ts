import { Dexie, liveQuery } from 'dexie';
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
} from 'rxjs';
import {
  exhaustMap,
  filter,
  map,
  mapTo,
  mergeMap,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';
import {
  EventTypesFromServer,
  CommandTypesFromClient,
  IDatabaseChange,
  NewChangesReceived,
} from '@harika/common';
import { isEqual } from 'lodash-es';
import { CommandsExecuter } from './CommandsExecuter';
import { applyChanges } from './applyChanges';

// table _syncStatus
export interface ISyncStatus {
  id: 1;
  lastReceivedRemoteRevision: number | null;
  lastAppliedRemoteRevision: number | null;
  source: string;
}

type IChangeRow = DistributiveOmit<IDatabaseChange, 'source'>;
type IChangeRowWithRev = IChangeRow & {
  rev: string;
};

export interface IServerChangesRow {
  id: string;
  change: IDatabaseChange;
  receivedAtRevisionOfServer: number;
}

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export class ServerSynchronizer {
  private isConnectedAndInitialized$: Observable<boolean>;
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
  private commandExecuter: CommandsExecuter;

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

    this.commandExecuter = new CommandsExecuter(
      this.log,
      this.socket$,
      this.isConnected$,
      this.stop$,
    );
  }

  async initialize() {
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
            this.commandExecuter.send(() => ({
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
    const channel = new BroadcastChannel(`dexieSync-${this.db.name}`);
    // TODO: what to do with leader duplication?
    const elector = createLeaderElection(channel);

    elector.awaitLeadership().then(() => {
      const socket = io(this.url, { transports: ['websocket'] });

      this.socketSubject.next(socket);
    });
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
          this.commandExecuter.send(() => {
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
          switchMap(() => {
            return this.db.transaction('rw', [changesTable], () =>
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
      exhaustMap(async ([, changeRows]) => {
        await applyChanges(this.db, changeRows);
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
      this.commandExecuter.send(() => ({
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

          // If changes === 0 means such changes are already applied by client
          // And we are in sync with server
          const lastAppliedRemoteRevision =
            data.changes.length === 0
              ? data.currentRevision
              : this.syncStatusSubject.value.lastAppliedRemoteRevision;

          this.db.table<ISyncStatus>('_syncStatus').update(1, {
            lastReceivedRemoteRevision: data.currentRevision,
            lastAppliedRemoteRevision,
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

  private log = (msg: string) => {
    console.debug(`[${this.gatewayName}][${this.scopeId}] ${msg}`);
  };
}
