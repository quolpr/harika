import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { blockLinksTable } from '../repositories/BlockLinkRepository';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE ${blockLinksTable} (
      id varchar(20) PRIMARY KEY,
      blockId varchar(20) NOT NULL,
      linkedToBlockId varchar(20) NOT NULL

      orderPosition INTEGER NOT NULL,

      updatedAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blocks_links_blockId ON ${blockLinksTable}(blockId);
    CREATE INDEX IF NOT EXISTS idx_blocks_links_linkedToBlockId ON ${blockLinksTable}(linkedToBlockId);
  `);
};

export const createBlocksLinksTable: IMigration = {
  up,
  id: 1632733297843, // just take current UTC time, with `new Date().getTime()`
  name: 'addBlocksLinksTable',
};
