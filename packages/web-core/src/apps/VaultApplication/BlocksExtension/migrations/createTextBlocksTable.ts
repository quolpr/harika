import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { childrenBlocksTrigger } from '../helpers/childrenBlocksTrigger';
import { linkedBlockTrigger } from '../helpers/linkedBlocksTrigger';
import {
  textBlocksFTSTable,
  textBlocksTable,
} from '../repositories/TextBlocksRepository';

// Maybe parentId will be better cause it will give 100% guarantee
// uniq of block child. If order conflict - then display it in UI
//
// We will have worse performance, but still performance would be decent
const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${textBlocksTable} (
      id varchar(20) PRIMARY KEY,
      content TEXT NOT NULL,

      linkedBlockIds TEXT NOT NULL DEFAULT '[]',

      parentId varchar(20),
      orderPosition INTEGER NOT NULL,

      updatedAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_note_blocks_title ON ${textBlocksTable}(title);
    CREATE INDEX IF NOT EXISTS idx_note_blocks_date ON ${textBlocksTable}(dailyNoteDate);
  `);

  await db.sqlExec(linkedBlockTrigger(textBlocksTable));
  await db.sqlExec(childrenBlocksTrigger(textBlocksTable));

  await db.sqlExec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${textBlocksFTSTable} USING fts5(id UNINDEXED, textContent);
  `);
};

export const createTextBlocksTable: IMigration = {
  up,
  id: 1632733297841, // just take current UTC time, with `new Date().getTime()`
  name: 'createTextBlocksTable',
};
