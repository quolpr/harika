import { createRxDatabase, addRxPlugin, RxDatabase, PouchDB } from 'rxdb';
import { RxDBNoValidatePlugin } from 'rxdb/plugins/no-validate';
import indexedDb from 'pouchdb-adapter-idb';
import { dbNotesCollection, NoteCollection } from './NoteRx';
import { dbNoteBlocksCollection, NoteBlockCollection } from './NoteBlockRx';
import { dbNoteLinkRxCollection, NoteLinkRxCollection } from './NoteLinkRx';
import { HarikaDatabaseDocuments } from './collectionTypes';
import pouchdbDebug from 'pouchdb-debug';

// (async() => {
//   console.time('timer1');
// await db.collections.noteblocks.pouch.find({
//   selector: {parentBlockId: 'c2gtteuve6:1607708583190'},
//   fields: ['_id', 'content'],
// })
//   console.timeEnd('timer1');
// })()
//

PouchDB.plugin(pouchdbDebug);

PouchDB.debug.enable('*');

addRxPlugin(RxDBNoValidatePlugin);
addRxPlugin(indexedDb);
//
// addRxPlugin(require('pouchdb-adapter-idb'));

export type DbCollections = {
  [HarikaDatabaseDocuments.NOTES]: NoteCollection;
  [HarikaDatabaseDocuments.NOTE_BLOCKS]: NoteBlockCollection;
  [HarikaDatabaseDocuments.NOTE_LINKS]: NoteLinkRxCollection;
};

export type HarikaRxDatabase = RxDatabase<DbCollections>;

export const initDb = async (id: string) => {
  const db: HarikaRxDatabase = await createRxDatabase<DbCollections>({
    name: `harika_notes_${id.replaceAll('-', '')}`,
    adapter: 'idb',
    eventReduce: false,
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
    [HarikaDatabaseDocuments.NOTES]: dbNotesCollection,
    [HarikaDatabaseDocuments.NOTE_BLOCKS]: dbNoteBlocksCollection,
    [HarikaDatabaseDocuments.NOTE_LINKS]: dbNoteLinkRxCollection,
  });

  return db;
};
