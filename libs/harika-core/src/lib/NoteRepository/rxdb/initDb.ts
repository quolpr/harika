import { createRxDatabase, addRxPlugin, RxDatabase, PouchDB } from 'rxdb';
import { RxDBNoValidatePlugin } from 'rxdb/plugins/no-validate';
import { dbNotesCollection, NoteCollection } from './NoteRx';
import { dbNoteBlocksCollection, NoteBlockCollection } from './NoteBlockDb';
import { dbNoteLinkCollection, NoteLinkCollection } from './NoteLinkRx';
import { HarikaDatabaseCollections } from './collectionTypes';
import pouchdbHttp from 'pouchdb-adapter-http';
import pouchdbDebug from 'pouchdb-debug';
import idb from 'pouchdb-adapter-indexeddb';

PouchDB.plugin(pouchdbDebug);

// PouchDB.debug.enable('*');

addRxPlugin(RxDBNoValidatePlugin);
addRxPlugin(pouchdbHttp);
addRxPlugin(idb);

export type DbCollections = {
  [HarikaDatabaseCollections.NOTES]: NoteCollection;
  [HarikaDatabaseCollections.NOTE_BLOCKS]: NoteBlockCollection;
  [HarikaDatabaseCollections.NOTE_LINKS]: NoteLinkCollection;
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
    [HarikaDatabaseCollections.NOTES]: dbNotesCollection,
    [HarikaDatabaseCollections.NOTE_BLOCKS]: dbNoteBlocksCollection,
    [HarikaDatabaseCollections.NOTE_LINKS]: dbNoteLinkCollection,
  });

  return db;
};
