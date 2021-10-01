import { DB } from '../db/core/DB';
import { IMigration } from '../db/core/types';
import { blocksScopesTable } from '../VaultApp/NoteBlock/repositories/BlockScopesRepository';
import {
  noteBlocksNotesTable,
  noteBlocksTable,
  noteBlocksFTSTable,
  notesFTSTable,
} from '../VaultApp/NoteBlock/repositories/NotesBlocksRepository';
import { notesTable } from '../VaultApp/NotesTree/repositories/NotesRepository';

const up = (db: DB<any>) => {
  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${notesTable} (
      id varchar(20) PRIMARY KEY,
      title varchar(255) NOT NULL,
      dailyNoteDate INTEGER,
      rootBlockId varchar(20) NOT NULL,
      updatedAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_title ON ${notesTable}(title);
    CREATE INDEX IF NOT EXISTS idx_notes_date ON ${notesTable}(dailyNoteDate);
  `);

  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${blocksScopesTable} (
      id varchar(100) PRIMARY KEY,
      collapsedBlockIds TEXT NOT NULL,
      noteId varchar(20) NOT NULL,
      rootBlockId varchar(20) NOT NULL,
      scopedModelId varchar(50) NOT NULL,
      scopedModelType varchar(50) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_${blocksScopesTable}_noteId ON ${blocksScopesTable}(noteId);
  `);

  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${noteBlocksNotesTable} (
      noteId varchar(20) NOT NULL,
      noteBlockId varchar(20) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_note_blocks_noteId ON ${noteBlocksNotesTable}(noteId);
    CREATE INDEX IF NOT EXISTS idx_notes_note_blocks_noteBlockId ON ${noteBlocksNotesTable}(noteBlockId);
  `);

  db.sqlExec(`
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

  db.sqlExec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${noteBlocksFTSTable} USING fts5(id UNINDEXED, textContent, tokenize="trigram");
  `);

  db.sqlExec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${notesFTSTable} USING fts5(id UNINDEXED, title, tokenize="trigram");
  `);

  db.sqlExec(`
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

export const initVaultsTables: IMigration = {
  up,
  id: 1632733297840, // just take current UTC time, with `new Date().getTime()`
  name: 'initVaultsTables',
};
