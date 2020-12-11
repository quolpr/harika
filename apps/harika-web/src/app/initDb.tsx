import { createRxDatabase, addRxPlugin, RxDatabase } from 'rxdb';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBReplicationPlugin } from 'rxdb/plugins/replication';
import { RxDBNoValidatePlugin } from 'rxdb/plugins/no-validate';
import indexedDb from 'pouchdb-adapter-indexeddb';
import { dbNotesCollection, NoteCollection } from './models/note';
import {
  dbNoteBlocksCollection,
  NoteBlockCollection,
} from './models/noteBlocks';
import { HarikaDatabaseDocuments } from './HarikaDatabaseDocuments';
import pouchdbDebug from 'pouchdb-debug';
import { PouchDB } from 'rxdb';

// (async() => {
//   console.time('timer1');
// await db.collections.noteblocks.pouch.find({
//   selector: {parentBlockId: 'c2gtteuve6:1607708583190'},
//   fields: ['_id', 'content'],
// })
//   console.timeEnd('timer1');
// })()

PouchDB.plugin(pouchdbDebug);

PouchDB.debug.enable('*');

addRxPlugin(RxDBNoValidatePlugin);
addRxPlugin(require('pouchdb-adapter-memory'));

export type DbCollections = {
  [HarikaDatabaseDocuments.NOTES]: NoteCollection;
  [HarikaDatabaseDocuments.NOTE_BLOCKS]: NoteBlockCollection;
};

export type HarikaDatabase = RxDatabase<DbCollections>;

export const initDb = async () => {
  console.log('DatabaseService: creating database..');
  const db: HarikaDatabase = await createRxDatabase<DbCollections>({
    name: 'harika_notes',
    adapter: 'memory',
    eventReduce: false,
  });

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
    [HarikaDatabaseDocuments.NOTES]: dbNotesCollection,
    [HarikaDatabaseDocuments.NOTE_BLOCKS]: dbNoteBlocksCollection,
  });
  console.log(db.collections.noteblocks.pouch);

  return db;
};
