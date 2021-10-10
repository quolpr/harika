import { DB } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { cardsTable } from '../repositories/CardsRepository';

const up = (db: DB<any>) => {
  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${cardsTable} (
      id varchar(20) PRIMARY KEY,
      blockId varchar(20) NOT NULL,
      nextDate INTEGER,

      interval INTEGER NOT NULL,
      factor INTEGER NOT NULL,

      frontText TEXT,

      updatedAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);
};

export const createCardsTable: IMigration = {
  up,
  id: 1633276288771, // just take current UTC time, with `new Date().getTime()`
  name: 'createCardsTable',
};
