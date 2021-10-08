import { DB } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { blocksTreeDescriptorsTable } from '../repositories/BlockTreeDescriptorsRepository';

const up = (db: DB<any>) => {
  db.sqlExec(`
    CREATE TABLE ${blocksTreeDescriptorsTable} (
      blockId varchar(20) NOT NULL,
      linkedToBlockId varchar(20) NOT NULL
    );
  `);
};

export const addBlocksTreeDescriptorsTable: IMigration = {
  up,
  id: 1633607297309, // just take current UTC time, with `new Date().getTime()`
  name: 'addBlocksTreeDescriptorTable',
};
