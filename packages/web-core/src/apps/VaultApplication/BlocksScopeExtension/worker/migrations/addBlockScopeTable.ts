import {DB} from "../../../../../extensions/DbExtension/DB";
import {IMigration} from "../../../../../extensions/DbExtension/types";
import {blocksScopesTable} from "../repositories/BlockScopesRepository";

const up = (db: DB<any>) => {
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
}

export const addBlockScopeTable: IMigration = {
  up,
  id: 163273329538, // just take current UTC time, with `new Date().getTime()`
  name: 'initNoteBlocksTables',
};
