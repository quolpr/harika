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

addRxPlugin(require('pouchdb-adapter-memory'));
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBReplicationPlugin);

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
  });

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

  return db;
};
