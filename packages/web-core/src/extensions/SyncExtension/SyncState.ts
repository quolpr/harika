import { injectable, inject } from 'inversify';
import { isEqual } from 'lodash-es';
import {
  BehaviorSubject,
  distinctUntilChanged,
  interval,
  map,
  merge,
  Observable,
  ReplaySubject,
  share,
  startWith,
  switchMap,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs';
import { STOP_SIGNAL } from '../../framework/types';
import { DB_NAME } from '../DbExtension/types';
import { SyncRepository } from './repositories/SyncRepository';
import { ServerConnector } from './serverSynchronizer/connection/ServerConnector';
import { ServerSynchronizer } from './serverSynchronizer/ServerSynchronizer';
import { DbEventsListenService } from './services/DbEventsListenerService';
import { SyncStatusService } from './services/SyncStatusService';

export type ISyncState = {
  isLeader: boolean;
  dbName: string;
  isConnectedAndReadyToUse: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  pendingClientChangesCount: number;
  pendingServerSnapshotsCount: number;
  lastAppliedRemoteRevision: number | null;
  lastReceivedRemoteRevision: number | null;
  currentClock: string;
};

export const defaultSyncState: ISyncState = {
  dbName: 'Loading...',
  isSyncing: false,
  pendingServerSnapshotsCount: 0,
  pendingClientChangesCount: 0,
  isConnected: false,
  isConnectedAndReadyToUse: false,
  isLeader: false,
  lastAppliedRemoteRevision: 0,
  lastReceivedRemoteRevision: 0,
  currentClock: '',
};

@injectable()
export class SyncStateService {
  private currentState$ = new BehaviorSubject<ISyncState>(defaultSyncState);

  constructor(
    @inject(SyncRepository)
    private syncRepo: SyncRepository,
    @inject(DB_NAME) private dbName: string,
    @inject(DbEventsListenService)
    private dbEventsListenService: DbEventsListenService,
    @inject(SyncStatusService) private syncStatusService: SyncStatusService,
    @inject(STOP_SIGNAL)
    private stop$: Observable<unknown>,
  ) {}

  get current$() {
    return this.currentState$;
  }

  initialize(
    syncer: ServerSynchronizer,
    serverConnector: ServerConnector,
    isLeader$: Observable<boolean>,
  ) {
    const storageKey = `sync-state-${this.dbName}`;

    const stateFormer = merge(
      this.dbEventsListenService.changesChannel$(),
      this.dbEventsListenService.newSyncPullsChannel$(),
      syncer.isSyncing$,
      serverConnector.isConnected$,
      serverConnector.isConnectedAndReadyToUse$,
      interval(10_000),
    ).pipe(
      startWith(null),
      switchMap(async (res) => {
        const [serverSnapshotsCount, clientChangesCount] =
          await this.syncRepo.getServerSnapshotsAndClientChangesCount();

        const syncStatus = await this.syncStatusService.getSyncStatus();

        return {
          isSyncing: syncer.isSyncing$.value,
          pendingClientChangesCount: clientChangesCount,
          pendingServerSnapshotsCount: serverSnapshotsCount,
          lastAppliedRemoteRevision: syncStatus.lastAppliedRemoteRevision,
          lastReceivedRemoteRevision: syncStatus.lastReceivedRemoteRevision,
          currentClock: syncStatus.currentClock,
        };
      }),
      withLatestFrom(
        serverConnector.isConnected$,
        (partialState, isConnected) => ({ ...partialState, isConnected }),
      ),
      withLatestFrom(
        serverConnector.isConnectedAndReadyToUse$,
        (partialState, isConnectedAndReadyToUse) => ({
          ...partialState,
          isConnectedAndReadyToUse,
        }),
      ),
      distinctUntilChanged((a, b) => isEqual(a, b)),
      tap((state) => {
        localStorage.setItem(storageKey, JSON.stringify(state));
      }),
      share({
        connector: () => new ReplaySubject(1),
      }),
    );

    const stateGetter = new Observable<string | null>((obs) => {
      console.log('start listening!');
      const callback = () => {
        obs.next(localStorage.getItem(storageKey));
      };
      window.addEventListener('storage', callback);

      obs.next(localStorage.getItem(storageKey));
      return () => {
        window.removeEventListener('storage', callback);
      };
    }).pipe(
      distinctUntilChanged(),
      map((val): ISyncState => (val ? JSON.parse(val) : defaultSyncState)),
    );

    isLeader$
      .pipe(
        switchMap((isLeader) => {
          return isLeader ? stateFormer : stateGetter;
        }),
        withLatestFrom(isLeader$, (partialState, isLeader) => ({
          ...partialState,
          isLeader,
          dbName: this.dbName,
        })),
        share({
          connector: () => this.currentState$,
        }),
        takeUntil(this.stop$),
      )
      .subscribe();
  }
}
