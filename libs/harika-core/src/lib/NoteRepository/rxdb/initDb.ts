import { createRxDatabase, addRxPlugin, RxDatabase, PouchDB } from 'rxdb';
import { RxDBNoValidatePlugin } from 'rxdb/plugins/no-validate';
import { dbNotesCollection, NoteCollection } from './NoteRx';
import { dbNoteBlocksCollection, NoteBlockCollection } from './NoteBlockDb';
import { HarikaDatabaseCollections as VaultDatabaseCollections } from './collectionTypes';
import pouchdbHttp from 'pouchdb-adapter-http';
import pouchdbDebug from 'pouchdb-debug';
import idb from 'pouchdb-adapter-indexeddb';

PouchDB.plugin(pouchdbDebug);

// PouchDB.debug.enable('*');

addRxPlugin(RxDBNoValidatePlugin);
addRxPlugin(pouchdbHttp);
addRxPlugin(idb);

export type DbCollections = {
  [VaultDatabaseCollections.NOTES]: NoteCollection;
  [VaultDatabaseCollections.NOTE_BLOCKS]: NoteBlockCollection;
};

export type VaultRxDatabase = RxDatabase<DbCollections>;

export const initDb = async (id: string, sync: false | { token: string }) => {
  const dbName = `harika_vault_${id}`;
  const db: VaultRxDatabase = await createRxDatabase<DbCollections>({
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
    [VaultDatabaseCollections.NOTES]: dbNotesCollection,
    [VaultDatabaseCollections.NOTE_BLOCKS]: dbNoteBlocksCollection,
  });

  if (sync) {
    await Promise.all(
      ([
        [VaultDatabaseCollections.NOTES as const, `harika_vault_${id}_notes`],
        [
          VaultDatabaseCollections.NOTE_BLOCKS as const,
          `harika_vault_${id}_noteblocks`,
        ],
      ] as [VaultDatabaseCollections, string][]).map(
        async ([collectionName, toSync]) => {
          const firstSync = db[collectionName].sync({
            remote: `http://94.228.113.213:5984/${toSync}`,
            waitForLeadership: false,
            options: {
              live: false,
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

          await firstSync.awaitInitialReplication();

          db[collectionName].sync({
            remote: `http://94.228.113.213:5984/${toSync}`,
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
      )
    );
  }

  return db;
};
