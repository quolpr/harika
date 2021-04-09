import { createRxDatabase, addRxPlugin, RxDatabase, PouchDB } from 'rxdb';
import { RxDBNoValidatePlugin } from 'rxdb/plugins/no-validate';
import { dbNotesCollection, NoteCollection } from './NoteDoc';
import { dbNoteBlocksCollection, NoteBlockCollection } from './NoteBlockDoc';
import { VaultDatabaseCollections } from './collectionTypes';
import pouchdbHttp from 'pouchdb-adapter-http';
import pouchdbDebug from 'pouchdb-debug';
import idb from 'pouchdb-adapter-indexeddb';
import { configureSync } from '../../utils/configureSync';

PouchDB.plugin(pouchdbDebug);

PouchDB.debug.enable('*');

addRxPlugin(RxDBNoValidatePlugin);
addRxPlugin(pouchdbHttp);
addRxPlugin(idb);

export type DbCollections = {
  [VaultDatabaseCollections.NOTES]: NoteCollection;
  [VaultDatabaseCollections.NOTE_BLOCKS]: NoteBlockCollection;
};

export type VaultRxDatabase = RxDatabase<DbCollections>;

export const initDb = async (id: string) => {
  const dbName = `harika_vault_${id}`;
  const db: VaultRxDatabase = await createRxDatabase<DbCollections>({
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
    [VaultDatabaseCollections.NOTES]: dbNotesCollection,
    [VaultDatabaseCollections.NOTE_BLOCKS]: dbNoteBlocksCollection,
  });

  return db;
};

export const initVaultSync = async (
  db: VaultRxDatabase,
  id: string,
  token: string
) => {
  await Promise.all(
    ([
      [VaultDatabaseCollections.NOTES as const, `harika_vault_${id}_notes`],
      [
        VaultDatabaseCollections.NOTE_BLOCKS as const,
        `harika_vault_${id}_noteblocks`,
      ],
    ] as [VaultDatabaseCollections, string][]).map(
      async ([collectionName, toSync]) => {
        const firstSync = db[collectionName].sync(
          configureSync({ db: toSync, token: token, firstTime: true })
        );

        await firstSync.awaitInitialReplication();

        db[collectionName].sync(
          configureSync({ db: toSync, token: token, firstTime: false })
        );
      }
    )
  );
};
