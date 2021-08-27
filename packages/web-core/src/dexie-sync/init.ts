import type { Remote } from 'comlink';
import { Subject } from 'rxjs';
import type { DbEventsService } from '../DbEventsService';
import type { BaseDbWorker } from '../SqlNotesRepository.worker';
import { CommandsExecuter } from './CommandsExecuter';
import { ServerConnector } from './connection/ServerConnector';
import { ServerSynchronizer } from './ServerSynchronizer';

export const initSync = async (
  dbName: string,
  dbWorker: Remote<BaseDbWorker>,
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
    serverConnector.socket$,
    serverConnector.channel$,
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
};
