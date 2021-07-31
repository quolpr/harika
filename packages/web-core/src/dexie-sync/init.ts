import type { Dexie } from 'dexie';
import { Subject } from 'rxjs';
import { startChangeLog } from './changesLogger';
import { CommandsExecuter } from './CommandsExecuter';
import { ServerConnector } from './connection/ServerConnector';
import {
  IConflictsResolver,
  IConsistencyResolver,
  ServerSynchronizer,
} from './ServerSynchronizer';
import { SyncStatusService } from './SyncStatusService';

export const initSync = async (
  db: Dexie,
  windowId: string,
  url: string,
  authToken: string,
  conflictResolver: IConflictsResolver,
  consistencyResolver: IConsistencyResolver | undefined,
) => {
  startChangeLog(db, windowId);

  const stop$: Subject<void> = new Subject();

  const log = (msg: string) => {
    console.debug(`[${db.name}] ${msg}`);
  };

  const syncStatus = new SyncStatusService(db);
  const serverConnector = new ServerConnector(
    db,
    url,
    authToken,
    syncStatus,
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
    db,
    syncStatus,
    commandExecuter,
    serverConnector,
    conflictResolver,
    stop$,
    log,
  );

  syncer.start();
};
