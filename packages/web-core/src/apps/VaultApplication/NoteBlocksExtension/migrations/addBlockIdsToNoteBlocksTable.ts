import { DB, IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import {
  blocksRelationsTable,
  noteBlocksTable,
} from '../repositories/NotesBlocksRepository';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    ALTER TABLE ${noteBlocksTable} ADD linkedBlockIds TEXT NOT NULL DEFAULT '[]';
  `);

  await db.sqlExec(`
    CREATE TABLE ${blocksRelationsTable} (
      blockId varchar(20) NOT NULL,
      linkedToBlockId varchar(20) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blocks_note_blocks_blockId ON ${blocksRelationsTable}(blockId);
    CREATE INDEX IF NOT EXISTS idx_blocks_note_blocks_linkedToBlockId ON ${blocksRelationsTable}(linkedToBlockId);
  `);

  await db.sqlExec(`
    CREATE TRIGGER populateNoteBlocksBlocksTable_insert AFTER INSERT ON ${noteBlocksTable} BEGIN
      DELETE FROM ${blocksRelationsTable} WHERE blockId = new.id;
      INSERT INTO ${blocksRelationsTable}(linkedToBlockId, blockId) SELECT j.value, new.id FROM json_each(new.linkedBlockIds) AS j;
    END;

    CREATE TRIGGER populateNoteBlocksBlocksTable_deleteBlock AFTER DELETE ON ${noteBlocksTable} BEGIN
      DELETE FROM ${blocksRelationsTable} WHERE blockId = old.id;
    END;

    CREATE TRIGGER populateNoteBlocksBlocksTable_update AFTER UPDATE ON ${noteBlocksTable} BEGIN
      DELETE FROM ${blocksRelationsTable} WHERE blockId = old.id;
      INSERT INTO ${blocksRelationsTable}(linkedToBlockId, blockId) SELECT j.value, new.id FROM json_each(new.linkedBlockIds) AS j;
    END;
  `);
};

export const addBlockIdsToNoteBlocksTables: IMigration = {
  up,
  id: 1632733297843, // just take current UTC time, with `new Date().getTime()`
  name: 'addBlockIdsToNoteBlocksTables',
};
