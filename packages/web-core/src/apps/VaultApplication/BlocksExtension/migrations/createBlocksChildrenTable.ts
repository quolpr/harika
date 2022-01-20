import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { blocksChildrenTable } from '../repositories/AllBlocksRepository';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE ${blocksChildrenTable} (
      blockId varchar(20) NOT NULL,
      parentId varchar(20) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blocks_children_blockId ON ${blocksChildrenTable}(blockId);
    CREATE INDEX IF NOT EXISTS idx_children_parentId ON ${blocksChildrenTable}(parentId);
  `);
};

export const createBlocksChildrenTable: IMigration = {
  up,
  id: 1632733297842, // just take current UTC time, with `new Date().getTime()`
  name: 'addBlocksChildrenTable',
};
