import type { Dexie } from 'dexie';
import { startChangeLog } from './changesLogger';
import { ServerSynchronizer } from './ServerSynchronizer';

export const initSync = (db: Dexie, dbId: string, url: string) => {
  startChangeLog(db);

  const syncer = new ServerSynchronizer(db, 'vault', dbId, url);

  syncer.initialize();
};
