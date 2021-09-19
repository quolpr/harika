import type { Remote } from 'comlink';
import {
  distinctUntilChanged,
  interval,
  merge,
  Observable,
  ReplaySubject,
  share,
  startWith,
  Subject,
  switchMap,
  withLatestFrom,
} from 'rxjs';
import type { DbEventsService } from '../DbEventsService';
import { CommandsExecuter } from './CommandsExecuter';
import { ServerConnector } from './connection/ServerConnector';
import { ServerSynchronizer } from './ServerSynchronizer';
import type { BaseDbSyncWorker } from '../persistence/BaseDbSyncWorker';
import { isEqual } from 'lodash-es';

export interface ISyncState {
  isSyncing: boolean;
  pendingClientChangesCount: number;
  pendingServerChangesCount: number;
  isConnected: boolean;
  isConnectedAndReadyToUse: boolean;
}

export const initSync = async (
  dbName: string,
  dbWorker: Remote<BaseDbSyncWorker>,
  url: string,
  authToken: string,
  eventsService: DbEventsService,
) => {
  const stop$: Subject<void> = new Subject();

  const log = (msg: string) => {
    console.debug(`[${dbName}] ${msg}`);
  };

  const syncRepo = await dbWorker.getSyncRepo();
  const syncStatus = await syncRepo.getSyncStatus();

  const serverConnector = new ServerConnector(
    dbName,
    syncStatus.clientId,
    url,
    authToken,
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

  const syncState$: Observable<ISyncState> = merge(
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
    share({
      connector: () => new ReplaySubject(1),
    }),
  );

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
