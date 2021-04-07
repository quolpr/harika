import { createRxDatabase, addRxPlugin, RxDatabase, PouchDB } from 'rxdb';
import pouchdbHttp from 'pouchdb-adapter-http';
import pouchdbDebug from 'pouchdb-debug';
import idb from 'pouchdb-adapter-indexeddb';
import { vaultCollection, VaultCollection } from './VaultDoc';
import { HarikaDbCollectionTypes } from './harikaCollectionTypes';
import { configureSync } from '../../utils/configureSync';

// PouchDB.plugin(pouchdbDebug);

// PouchDB.debug.enable('*');

addRxPlugin(pouchdbHttp);
addRxPlugin(idb);

export type HarikaDbCollections = {
  [HarikaDbCollectionTypes.VAULTS]: VaultCollection;
};

export type HarikaRxDatabase = RxDatabase<HarikaDbCollections>;

export const initHarikaDb = async (id: string) => {
  const dbName = `harika_${id}`;

  const db: HarikaRxDatabase = await createRxDatabase<HarikaDbCollections>({
    name: dbName,
    adapter: 'indexeddb',
    pouchSettings: {
      revs_limit: 0,
    },
    multiInstance: true,
    ignoreDuplicate: false,
  });

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.db = db;

  console.log('DatabaseService: created database');

  // create collections
  console.log('DatabaseService: create collections');

  await db.addCollections({
    [HarikaDbCollectionTypes.VAULTS]: vaultCollection,
  });

  return db;
};

export const initHarikaSync = async (
  db: HarikaRxDatabase,
  id: string,
  token: string
) => {
  const dbName = `harika_vaults_${id}`;

  const firstSync = db.vaults.sync(
    configureSync({ db: dbName, token: token, firstTime: true })
  );

  await firstSync.awaitInitialReplication();

  db.vaults.sync(configureSync({ db: dbName, token: token, firstTime: false }));
};
