import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { blocksTreeDescriptorsTable } from '../repositories/BlockTreeDescriptorsRepository';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE ${blocksTreeDescriptorsTable} (
      id varchar(20) PRIMARY KEY,
      rootBlockId varchar(20) NOT NULL
    );
  `);
};

export const addBlocksTreeDescriptorsTable: IMigration = {
  up,
  id: 1633607297309, // just take current UTC time, with `new Date().getTime()`
  name: 'addBlocksTreeDescriptorTable',
};
