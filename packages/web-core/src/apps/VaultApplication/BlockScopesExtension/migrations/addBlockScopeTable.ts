import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { blocksScopesTable } from '../repositories/BlockScopesRepository';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${blocksScopesTable} (
      id varchar(100) PRIMARY KEY,
      collapsedBlockIds TEXT NOT NULL,
      rootBlockId varchar(20) NOT NULL,
      scopeId varchar(50) NOT NULL,
      scopeType varchar(50) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_${blocksScopesTable}_rootBlockId ON ${blocksScopesTable}(rootBlockId);
  `);
};

export const addBlockScopeTable: IMigration = {
  up,
  id: 163273329538, // just take current UTC time, with `new Date().getTime()`
  name: 'addBlockScopeTable',
};
