import type { Dexie } from 'dexie';
import { Subject } from 'rxjs';
import { startChangeLog } from './changesLogger';
import { CommandsExecuter } from './CommandsExecuter';
import { ServerConnector } from './connection/ServerConnector';
import { IConflictsResolver, ServerSynchronizer } from './ServerSynchronizer';
import { SyncStatusService } from './SyncStatusService';

export const initSync = async (
  db: Dexie,
  dbId: string,
  windowId: string,
  url: string,
  authToken: string,
  conflictResolver: IConflictsResolver,
) => {
  startChangeLog(db, windowId);

  const stop$: Subject<void> = new Subject();

  const log = (msg: string) => {
    console.debug(`[vault][${dbId}] ${msg}`);
  };

  const syncStatus = new SyncStatusService(db);
  const serverConnector = new ServerConnector(
    db,
    url,
    authToken,
    syncStatus,
    stop$,
  );
  const commandExecuter = new CommandsExecuter(
    serverConnector.socket$,
    serverConnector.channel$,
    log,
    stop$,
  );

  const syncer = new ServerSynchronizer(
    db,
    syncStatus,
    commandExecuter,
    serverConnector,
    conflictResolver,
    stop$,
  );

  syncer.initialize();
};
