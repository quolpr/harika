import type { Dexie } from 'dexie';
import { Subject } from 'rxjs';
import { startChangeLog } from './changesLogger';
import { CommandsExecuter } from './CommandsExecuter';
import { ConnectionInitializer } from './connection/ConnectionInitializer';
import { ServerConnector } from './connection/ServerConnector';
import { IConflictsResolver, ServerSynchronizer } from './ServerSynchronizer';
import { SyncStatusService } from './SyncStatusService';

export const initSync = (
  db: Dexie,
  dbId: string,
  windowId: string,
  url: string,
  conflictResolver: IConflictsResolver,
) => {
  startChangeLog(db, windowId);

  const stop$: Subject<void> = new Subject();

  const log = (msg: string) => {
    console.debug(`[vault][${dbId}] ${msg}`);
  };

  const syncStatus = new SyncStatusService(db);
  const serverConnector = new ServerConnector(db, url, stop$);
  const commandExecuter = new CommandsExecuter(
    serverConnector.socket$,
    serverConnector.isConnected$,
    log,
    stop$,
  );
  const connectionInitializer = new ConnectionInitializer(
    serverConnector.isConnected$,
    commandExecuter,
    syncStatus,
    dbId,
    stop$,
  );

  const syncer = new ServerSynchronizer(
    db,
    syncStatus,
    commandExecuter,
    serverConnector,
    connectionInitializer,
    conflictResolver,
    stop$,
  );

  syncer.initialize();
};
