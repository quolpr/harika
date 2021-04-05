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

export const initHarikaDb = async (
  id: string,
  sync: false | { token: string }
) => {
  const dbName = `harika_${id}`;

  const db: HarikaRxDatabase = await createRxDatabase<HarikaDbCollections>({
    name: dbName,
    adapter: 'indexeddb',
    pouchSettings: {
      revs_limit: 0,
    },
    multiInstance: true,
    ignoreDuplicate: true,
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
    console.log(
      await fetch('https://app-dev.harika.io/db/_session', {
        headers: {
          Authorization: `Basic ${sync.token}`,
          'Content-Type': 'application/json',
        },
      })
    );

    const firstSync = db.vaults.sync({
      remote: `https://app-dev.harika.io/db/harika_vaults_${id}`,
      waitForLeadership: false,
      options: {
        live: false,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        fetch: (url, opts) => {
          return PouchDB.fetch(url, {
            ...opts,
            headers: {
              ...opts.headers,
              Authorization: `Basic ${sync.token}`,
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });
        },
      },
    });

    await firstSync.awaitInitialReplication();

    db.vaults.sync({
      remote: `https://app-dev.harika.io/db/harika_vaults_${id}`,
      waitForLeadership: true,
      options: {
        live: true,
        retry: true,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        fetch: (url, opts) =>
          PouchDB.fetch(url, {
            ...opts,
            headers: {
              ...opts.headers,
              Authorization: `Basic ${sync.token}`,
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          }),
      },
    });
  }

  return db;
};
