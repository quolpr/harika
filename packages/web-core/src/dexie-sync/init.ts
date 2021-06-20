import type { Dexie } from 'dexie';
import { startChangeLog } from './changesLogger';
import { ServerSynchronizer } from './ServerSynchronizer';

export const initSync = (
  db: Dexie,
  dbId: string,
  windowId: string,
  url: string,
) => {
  startChangeLog(db, windowId);

  const syncer = new ServerSynchronizer(db, 'vault', dbId, url);

  syncer.initialize();
};
