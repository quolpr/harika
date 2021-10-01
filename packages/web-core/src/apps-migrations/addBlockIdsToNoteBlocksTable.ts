import { DB } from '../db/core/DB';
import { IMigration } from '../db/core/types';
import {
  noteBlocksBlocksTable,
  noteBlocksTable,
} from '../VaultApp/NoteBlocksApp/repositories/NotesBlocksRepository';

const up = (db: DB<any>) => {
  db.sqlExec(`
    ALTER TABLE ${noteBlocksTable} ADD linkedBlockIds TEXT NOT NULL DEFAULT '[]';
  `);

  db.sqlExec(`
    CREATE TABLE ${noteBlocksBlocksTable} (
      blockId varchar(20) NOT NULL,
      linkedToBlockId varchar(20) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blocks_note_blocks_blockId ON ${noteBlocksBlocksTable}(blockId);
    CREATE INDEX IF NOT EXISTS idx_blocks_note_blocks_linkedToBlockId ON ${noteBlocksBlocksTable}(linkedToBlockId);
  `);

  db.sqlExec(`
    CREATE TRIGGER populateNoteBlocksBlocksTable_insert AFTER INSERT ON ${noteBlocksTable} BEGIN
      DELETE FROM ${noteBlocksBlocksTable} WHERE blockId = new.id;
      INSERT INTO ${noteBlocksBlocksTable}(linkedToBlockId, blockId) SELECT j.value, new.id FROM json_each(new.linkedBlockIds) AS j;
    END;

    CREATE TRIGGER populateNoteBlocksBlocksTable_deleteBlock AFTER DELETE ON ${noteBlocksTable} BEGIN
      DELETE FROM ${noteBlocksBlocksTable} WHERE blockId = old.id;
    END;

    CREATE TRIGGER populateNoteBlocksBlocksTable_update AFTER UPDATE ON ${noteBlocksTable} BEGIN
      DELETE FROM ${noteBlocksBlocksTable} WHERE blockId = old.id;
      INSERT INTO ${noteBlocksBlocksTable}(linkedToBlockId, blockId) SELECT j.value, new.id FROM json_each(new.linkedBlockIds) AS j;
    END;
  `);
};

export const addBlockIdsToNoteBlocksTables: IMigration = {
  up,
  id: 1632733297843, // just take current UTC time, with `new Date().getTime()`
  name: 'addBlockIdsToNoteBlocksTables',
};
