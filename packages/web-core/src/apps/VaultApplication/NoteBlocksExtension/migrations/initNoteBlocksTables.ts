import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import {
  noteBlocksNotesTable,
  noteBlocksTable,
  noteBlocksFTSTable,
} from '../repositories/NotesBlocksRepository';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${noteBlocksNotesTable} (
      noteId varchar(20) NOT NULL,
      noteBlockId varchar(20) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_note_blocks_noteId ON ${noteBlocksNotesTable}(noteId);
    CREATE INDEX IF NOT EXISTS idx_notes_note_blocks_noteBlockId ON ${noteBlocksNotesTable}(noteBlockId);
  `);

  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${noteBlocksTable} (
      id varchar(20) PRIMARY KEY,
      noteId varchar(20) NOT NULL,
      noteBlockIds TEXT NOT NULL,
      linkedNoteIds TEXT NOT NULL,
      content TEXT NOT NULL,
      updatedAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_note_blocks_noteId ON ${noteBlocksTable}(noteId);
  `);

  await db.sqlExec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${noteBlocksFTSTable} USING fts5(id UNINDEXED, textContent, tokenize="trigram");
  `);

  await db.sqlExec(`
    CREATE TRIGGER IF NOT EXISTS populateNoteBlocksNotesTable_insert AFTER INSERT ON ${noteBlocksTable} BEGIN
      DELETE FROM ${noteBlocksNotesTable} WHERE noteBlockId = new.id;
      INSERT INTO ${noteBlocksNotesTable}(noteId, noteBlockId) SELECT j.value, new.id FROM json_each(new.linkedNoteIds) AS j;
    END;

    -- after delete trigger on notes table is not required cause noteBlocks table is source of truth
    CREATE TRIGGER IF NOT EXISTS populateNoteBlocksNotesTable_deleteBlock AFTER DELETE ON ${noteBlocksTable} BEGIN
      DELETE FROM ${noteBlocksNotesTable} WHERE noteBlockId = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS populateNoteBlocksNotesTable_update AFTER UPDATE ON ${noteBlocksTable} BEGIN
      DELETE FROM ${noteBlocksNotesTable} WHERE noteBlockId = old.id;
      INSERT INTO ${noteBlocksNotesTable}(noteId, noteBlockId) SELECT j.value, new.id FROM json_each(new.linkedNoteIds) AS j;
    END;
  `);
};

export const initNoteBlocksTables: IMigration = {
  up,
  id: 163273329540, // just take current UTC time, with `new Date().getTime()`
  name: 'initNoteBlocksTables',
};
