import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { blocksLinksTable } from '../repositories/BaseBlockRepository';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE ${blocksLinksTable} (
      blockId varchar(20) NOT NULL,
      linkedToBlockId varchar(20) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blocks_links_blockId ON ${blocksLinksTable}(blockId);
    CREATE INDEX IF NOT EXISTS idx_blocks_links_linkedToBlockId ON ${blocksLinksTable}(linkedToBlockId);
  `);
};

export const createBlocksLinksTable: IMigration = {
  up,
  id: 1632733297843, // just take current UTC time, with `new Date().getTime()`
  name: 'addBlocksLinksTable',
};
