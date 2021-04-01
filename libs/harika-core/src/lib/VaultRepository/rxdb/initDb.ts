import { createRxDatabase, addRxPlugin, RxDatabase, PouchDB } from 'rxdb';
import pouchdbHttp from 'pouchdb-adapter-http';
import pouchdbDebug from 'pouchdb-debug';
import idb from 'pouchdb-adapter-indexeddb';
import { vaultCollection, VaultCollection } from './VaultDoc';
import { HarikaDbCollectionTypes } from './harikaCollectionTypes';

PouchDB.plugin(pouchdbDebug);

// PouchDB.debug.enable('*');

addRxPlugin(pouchdbHttp);
addRxPlugin(idb);

export type HarikaDbCollections = {
  [HarikaDbCollectionTypes.VAULTS]: VaultCollection;
};

export type HarikaRxDatabase = RxDatabase<HarikaDbCollections>;

export const initHarikaDb = async (id: string, sync: boolean) => {
  const dbName = `harika_${id}`;

  const db: HarikaRxDatabase = await createRxDatabase<HarikaDbCollections>({
    name: dbName,
    adapter: 'indexeddb',
    pouchSettings: {
      revs_limit: 0,
    },
    multiInstance: true,
  });

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.db = db;

  console.log('DatabaseService: created database');

  // show leadership in title
  db.waitForLeadership().then(() => {
    console.log('isLeader now');
    document.title = '♛ ' + document.title;
  });

  // create collections
  console.log('DatabaseService: create collections');

  await db.addCollections({
    [HarikaDbCollectionTypes.VAULTS]: vaultCollection,
  });

  if (sync) {
    const firstSync = db.vaults.sync({
      remote: `http://localhost:5984/${dbName}_vaults`,
      waitForLeadership: false,
      options: {
        live: false,
        fetch: (url, opts) =>
          PouchDB.fetch(url, {
            ...opts,
            credentials: 'include',
          }),
      },
    });

    await firstSync.awaitInitialReplication();

    db.vaults.sync({
      remote: `http://localhost:5984/${dbName}_vaults`,
      waitForLeadership: true,
      options: {
        live: true,
        retry: true,
        fetch: (url, opts) =>
          PouchDB.fetch(url, {
            ...opts,
            credentials: 'include',
          }),
      },
    });
  }

  return db;
};
