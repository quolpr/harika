import { createRxDatabase, addRxPlugin, RxDatabase, PouchDB } from 'rxdb';
import pouchdbHttp from 'pouchdb-adapter-http';
import pouchdbDebug from 'pouchdb-debug';
import idb from 'pouchdb-adapter-indexeddb';
import { vaultCollection, VaultCollection } from './VaultDoc';
import { StockCollectionTypes } from './stockCollectionTypes';

PouchDB.plugin(pouchdbDebug);

// PouchDB.debug.enable('*');

addRxPlugin(pouchdbHttp);
addRxPlugin(idb);

export type StockDbCollections = {
  [StockCollectionTypes.VAULTS]: VaultCollection;
};

export type StockRxDatabase = RxDatabase<StockDbCollections>;

export const initDb = async (id: string) => {
  const db: StockRxDatabase = await createRxDatabase<StockDbCollections>({
    name: `harika_stock_${id}`,
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
    [StockCollectionTypes.VAULTS]: vaultCollection,
  });

  return db;
};
