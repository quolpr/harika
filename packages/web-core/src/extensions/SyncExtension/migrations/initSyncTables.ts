import {
  serverSnapshotsPullsTable,
  serverSnapshotsTable,
  clientChangesTable,
} from '../repositories/SyncRepository';
import { IMigration } from '../../DbExtension/types';
import { IQueryExecuter } from '../../DbExtension/DB';
import { syncStatusTable } from '../services/SyncStatusService';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${syncStatusTable} (
      id varchar(20) PRIMARY KEY,
      lastReceivedRemoteRevision INTEGER,
      lastAppliedRemoteRevision INTEGER,
      clientId varchar(36) NOT NULL,
      currentClock varchar(36) NOT NULL
    )
  `);

  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${serverSnapshotsPullsTable} (
      id varchar(36) PRIMARY KEY,
      serverRevision INTEGER NOT NULL
    );
  `);

  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${serverSnapshotsTable} (
      id varchar(36) PRIMARY KEY,

      collectionName varchar(36) NOT NULL,
      doc TEXT NOT NULL,
      docId varchar(36) NOT NULL,
      lastTimestamp varchar(36)  NOT NULL,
      scopeId varchar(36),
      isDeleted INTEGER NOT NULL,
      
      pullId varchar(36) NOT NULL,
      rev INTEGER NOT NULL,

      FOREIGN KEY(pullId) REFERENCES ${serverSnapshotsPullsTable}(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_change_from_server_pullId ON ${serverSnapshotsTable}(pullId);
  `);

  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS incrementTable (value INT, tableName TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_incrementTable ON incrementTable(tableName);
    INSERT OR IGNORE INTO incrementTable VALUES (0, '${clientChangesTable}');
  `);

  await db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${clientChangesTable} (
      id varchar(36) PRIMARY KEY,
      type varchar(10) NOT NULL,
      collectionName varchar(10) NOT NULL,
      docId varchar(36) NOT NULL,
      doc TEXT,
      changeFrom TEXT,
      changeTo TEXT,
      rev INTEGER NOT NULL DEFAULT 0,
      scopeId varchar(36),
      timestamp varchar(36) NOT NULL
    );

    CREATE TRIGGER IF NOT EXISTS setRev_${clientChangesTable} AFTER INSERT ON ${clientChangesTable} BEGIN
        UPDATE  incrementTable
        SET     value = value + 1
        WHERE   tableName = '${clientChangesTable}';

        UPDATE  ${clientChangesTable}
        SET     rev = (
                    SELECT value
                    FROM incrementTable
                    WHERE tableName = '${clientChangesTable}')
        WHERE   id = new.id;
    END;
  `);
};

export const initSyncTables: IMigration = {
  up,
  id: 1632733297839, // just take current UTC time, with `new Date().getTime()`
  name: 'initSyncTables',
};
