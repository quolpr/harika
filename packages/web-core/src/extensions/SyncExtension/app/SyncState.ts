import { Remote } from 'comlink';
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
import { STOP_SIGNAL } from '../../../framework/types';
import { toRemoteName } from '../../../framework/utils';
import { DB_NAME } from '../../DbExtension/types';
import { SyncRepository } from '../worker/repositories/SyncRepository';
import { ServerConnector } from './serverSynchronizer/connection/ServerConnector';
import { ServerSynchronizer } from './serverSynchronizer/ServerSynchronizer';
import { DbEventsListenService } from './services/DbEventsListenerService';

export type ISyncState = {
  isLeader: boolean;
  dbName: string;
  isConnectedAndReadyToUse: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  pendingClientChangesCount: number;
  pendingServerChangesCount: number;
};

export const defaultSyncState: ISyncState = {
  dbName: 'Loading...',
  isSyncing: false,
  pendingServerChangesCount: 0,
  pendingClientChangesCount: 0,
  isConnected: false,
  isConnectedAndReadyToUse: false,
  isLeader: false,
};

@injectable()
export class SyncStateService {
  private currentState$ = new BehaviorSubject<ISyncState>(defaultSyncState);

  constructor(
    @inject(toRemoteName(SyncRepository))
    private syncRepo: Remote<SyncRepository>,
    @inject(DB_NAME) private dbName: string,
    @inject(DbEventsListenService)
    private dbEventsListenService: DbEventsListenService,
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
      switchMap(async () => {
        const [serverCount, clientCount] =
          await this.syncRepo.getServerAndClientChangesCount();

        return {
          isSyncing: syncer.isSyncing$.value,
          pendingClientChangesCount: clientCount,
          pendingServerChangesCount: serverCount,
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
