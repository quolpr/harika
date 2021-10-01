import { DB } from '../db/core/DB';
import { IMigration } from '../db/core/types';
import { vaultsTable } from '../UserApp/repositories/VaultsRepository';

const up = (db: DB<any>) => {
  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${vaultsTable} (
      id varchar(20) PRIMARY KEY,
      name varchar(255) NOT NULL,
      updatedAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);
};

export const initUsersDbTables: IMigration = {
  up,
  id: 1632733297841, // just take current UTC time, with `new Date().getTime()`
  name: 'initUsersDbTables',
};
