import { createRxDatabase, addRxPlugin, RxDatabase, PouchDB } from 'rxdb';
import { RxDBNoValidatePlugin } from 'rxdb/plugins/no-validate';
import { dbNotesCollection, NoteCollection } from './NoteRx';
import { dbNoteBlocksCollection, NoteBlockCollection } from './NoteBlockDb';
import { dbNoteLinkCollection, NoteLinkCollection } from './NoteLinkRx';
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
  [VaultDatabaseCollections.NOTE_LINKS]: NoteLinkCollection;
};

export type VaultRxDatabase = RxDatabase<DbCollections>;

export const initDb = async (id: string) => {
  const db: VaultRxDatabase = await createRxDatabase<DbCollections>({
    name: `harika_vault_${id.replaceAll('-', '')}`,
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
    [VaultDatabaseCollections.NOTES]: dbNotesCollection,
    [VaultDatabaseCollections.NOTE_BLOCKS]: dbNoteBlocksCollection,
    [VaultDatabaseCollections.NOTE_LINKS]: dbNoteLinkCollection,
  });

  return db;
};
