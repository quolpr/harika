import {
  syncStatusTable,
  serverChangesPullsTable,
  serverChangesTable,
  clientChangesTable,
} from '../../lib/db/sync/persistence/SyncRepository';
import { DB } from '../../extensions/DbExtension/DB';
import { IMigration } from '../../extensions/DbExtension/types';

const up = (db: DB<any>) => {
  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${syncStatusTable} (
      id varchar(20) PRIMARY KEY,
      lastReceivedRemoteRevision INTEGER,
      lastAppliedRemoteRevision INTEGER,
      clientId varchar(36) NOT NULL
    )
  `);

  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${serverChangesPullsTable} (
      id varchar(36) PRIMARY KEY,
      serverRevision INTEGER NOT NULL
    );
  `);

  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${serverChangesTable} (
      id varchar(36) PRIMARY KEY,

      pullId varchar(36) NOT NULL,
      rev INTEGER NOT NULL,

      type varchar(10) NOT NULL,
      inTable varchar(10) NOT NULL,
      key varchar(36) NOT NULL,
      obj TEXT,
      changeFrom TEXT,
      changeTo TEXT,

      FOREIGN KEY(pullId) REFERENCES ${serverChangesPullsTable}(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_change_from_server_pullId ON ${serverChangesTable}(pullId);
  `);

  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS incrementTable (value INT, tableName TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_incrementTable ON incrementTable(tableName);
    INSERT OR IGNORE INTO incrementTable VALUES (0, '${clientChangesTable}');
  `);

  db.sqlExec(`
    CREATE TABLE IF NOT EXISTS ${clientChangesTable} (
      id varchar(36) PRIMARY KEY,
      type varchar(10) NOT NULL,
      inTable varchar(10) NOT NULL,
      key varchar(36) NOT NULL,
      obj TEXT NOT NULL,
      changeFrom TEXT,
      changeTo TEXT,
      rev INTEGER NOT NULL DEFAULT 0
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
