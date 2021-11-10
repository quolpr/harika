import {
  syncStatusTable,
  serverChangesPullsTable,
  serverChangesTable,
  changesTable,
} from '../repositories/SyncRepository';
import { IMigration } from '../../DbExtension/types';
import { IQueryExecuter } from '../../DbExtension/DB';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${syncStatusTable} (
      id varchar(20) PRIMARY KEY,
      lastReceivedRemoteRevision varchar(36),
      clientId varchar(36) NOT NULL
    )
  `);

  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${serverChangesPullsTable} (
      id varchar(36) PRIMARY KEY,
      serverRevision varchar(36) NOT NULL
    );
  `);

  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${serverChangesTable} (
      id varchar(36) PRIMARY KEY,

      pullId varchar(36) NOT NULL,

      type varchar(10) NOT NULL,
      inTable varchar(10) NOT NULL,
      key varchar(36) NOT NULL,
      obj TEXT,
      changeFrom TEXT,
      changeTo TEXT,
      clientId varchar(36) NOT NULL,
      timestamp TEXT,

      FOREIGN KEY(pullId) REFERENCES ${serverChangesPullsTable}(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_change_from_server_pullId ON ${serverChangesTable}(pullId);
  `);

  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${changesTable} (
      id varchar(36) PRIMARY KEY,
      type varchar(10) NOT NULL,
      inTable varchar(10) NOT NULL,
      key varchar(36) NOT NULL,
      obj TEXT NOT NULL,
      changeFrom TEXT,
      changeTo TEXT,
      timestamp TEXT,
      clientId varchar(36) NOT NULL,
    );
  `);
};

export const initSyncTables: IMigration = {
  up,
  id: 1632733297839, // just take current UTC time, with `new Date().getTime()`
  name: 'initSyncTables',
};
