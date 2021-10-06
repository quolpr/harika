import type { Remote } from 'comlink';
import {
  distinctUntilChanged,
  interval,
  map,
  merge,
  Observable,
  ReplaySubject,
  share,
  startWith,
  Subject,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs';
import type { DbEventsListenService } from '../services/DbEventsListenerService';
import { CommandsExecuter } from './CommandsExecuter';
import { ServerConnector } from './connection/ServerConnector';
import { ServerSynchronizer } from './ServerSynchronizer';
import type { BaseDbSyncWorker } from '../persistence/BaseDbSyncWorker';
import { isEqual } from 'lodash-es';
import { createLeaderElection, BroadcastChannel } from 'broadcast-channel';

export interface ISyncState {
  isSyncing: boolean;
  pendingClientChangesCount: number;
  pendingServerChangesCount: number;
  isConnected: boolean;
  isConnectedAndReadyToUse: boolean;
  isLeader: boolean;
}

export const defaultSyncState = {
  isSyncing: false,
  pendingServerChangesCount: 0,
  pendingClientChangesCount: 0,
  isConnected: false,
  isConnectedAndReadyToUse: false,
  isLeader: false,
};

const getIsLeader$ = (dbName: string) => {
  return new Observable<boolean>((observer) => {
    const channel = new BroadcastChannel(`sync-${dbName}`);
    const elector = createLeaderElection(channel);

    elector.awaitLeadership().then(() => {
      observer.next(true);
    });

    elector.onduplicate = () => {
      observer.next(false);
    };
  }).pipe(
    startWith(false),
    share({
      connector: () => new ReplaySubject(1),
    }),
  );
};

export const initSync = async (
  dbName: string,
  dbWorker: Remote<BaseDbSyncWorker>,
  url: string,
  authToken: string,
  eventsService: DbEventsListenService,
  isServerConnectionAllowed$: Observable<boolean>,
) => {
  const stop$: Subject<void> = new Subject();
  const isLeader$ = getIsLeader$(dbName);

  const log = (msg: string) => {
    // console.debug(`[${dbName}] ${msg}`);
  };

  const syncRepo = await dbWorker.getSyncRepo();
  const syncStatus = await syncRepo.getSyncStatus();

  const serverConnector = new ServerConnector(
    dbName,
    syncStatus.clientId,
    url,
    authToken,
    isLeader$,
    isServerConnectionAllowed$,
    log,
    stop$,
  );
  const commandExecuter = new CommandsExecuter(
    serverConnector.socketSubject,
    serverConnector.channelSubject,
    log,
    stop$,
  );

  const syncer = new ServerSynchronizer(
    syncRepo,
    await dbWorker.getApplyChangesService(),
    commandExecuter,
    serverConnector,
    eventsService.changesChannel$(),
    eventsService.newSyncPullsChannel$(),
    stop$,
    log,
  );

  syncer.start();

  const getSyncState$ = (): Observable<ISyncState> => {
    const storageKey = `sync-state-${dbName}`;

    const stateFormer = merge(
      eventsService.changesChannel$(),
      eventsService.newSyncPullsChannel$(),
      syncer.isSyncing$,
      serverConnector.isConnected$,
      serverConnector.isConnectedAndReadyToUse$,
      interval(10_000),
    ).pipe(
      startWith(null),
      switchMap(async () => {
        const [serverCount, clientCount] =
          await syncRepo.getServerAndClientChangesCount();

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

    return isLeader$.pipe(
      switchMap((isLeader) => {
        return isLeader ? stateFormer : stateGetter;
      }),
      withLatestFrom(isLeader$, (partialState, isLeader) => ({
        ...partialState,
        isLeader,
      })),
    );
  };

  const syncState$ = getSyncState$();
  syncState$.subscribe((state) => {
    console.log(
      `%c[${dbName}] New sync state: ${JSON.stringify(state)}`,
      'color:cyan;border:1px solid dodgerblue',
    );
  });

  return {
    isConnected$: serverConnector.isConnected$,
    isConnectedAndReadyToUse$: serverConnector.isConnectedAndReadyToUse$,
    syncState$,
  };
};
