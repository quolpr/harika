import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import {
  noteBlocksFTSTable,
  noteBlocksTable,
} from '../../NotesExtension/repositories/NotesRepository';
import { childrenBlocksTrigger } from '../helpers/childrenBlocksTrigger';
import { linkedBlockTrigger } from '../helpers/linkedBlocksTrigger';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${noteBlocksTable} (
      id varchar(20) PRIMARY KEY,
      title varchar(255) NOT NULL,
      dailyNoteDate INTEGER,

      linkedBlockIds TEXT NOT NULL DEFAULT '[]',

      parentId varchar(20) NOT NULL,
      orderPosition INTEGER NOT NULL,

      updatedAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_note_blocks_title ON ${noteBlocksTable}(title);
    CREATE INDEX IF NOT EXISTS idx_note_blocks_date ON ${noteBlocksTable}(dailyNoteDate);
  `);

  await db.sqlExec(linkedBlockTrigger(noteBlocksTable));
  await db.sqlExec(childrenBlocksTrigger(noteBlocksTable));

  await db.sqlExec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${noteBlocksFTSTable} USING fts5(id UNINDEXED, title);
  `);
};

export const createNoteBlocksTable: IMigration = {
  up,
  id: 1632733297840, // just take current UTC time, with `new Date().getTime()`
  name: 'createNoteBlocksTable',
};
