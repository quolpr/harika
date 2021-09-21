import { chunk } from 'lodash-es';
import Q from 'sql-bricks';
// @ts-ignore
import sqlWasmUrl from '@harika-org/sql.js/dist/sql-wasm.wasm?url';
import initSqlJs, {
  Database,
  BindParams,
  QueryExecResult,
} from '@harika-org/sql.js';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';
import { shareCtx } from './ctx';
import { vaultsTable } from '../UserContext/persistence/VaultsRepository';
import {
  noteBlocksNotesTable,
  noteBlocksTable,
  noteBlocksFTSTable,
  notesFTSTable,
} from '../VaultContext/persistence/NotesBlocksRepository';
import { notesTable } from '../VaultContext/persistence/NotesRepository';
import {
  clientChangesTable,
  serverChangesPullsTable,
  serverChangesTable,
  syncStatusTable,
} from '../db-sync/persistence/SyncRepository';
import { blocksScopesTable } from '../VaultContext/persistence/BlockScopesRepository';

// @ts-ignore
Q.update.defineClause('or', '{{#if _or}}OR {{_or}}{{/if}}', {
  after: 'update',
});
// @ts-ignore
Q.insert.defineClause('or', '{{#if _or}}OR {{_or}}{{/if}}', {
  after: 'insert',
});

const or_methods = {
  orReplace: 'REPLACE',
  orRollback: 'ROLLBACK',
  orAbort: 'ABORT',
  orFail: 'FAIL',
};
Object.keys(or_methods).forEach(function (method) {
  Q.insert.prototype[method] = Q.update.prototype[method] = function () {
    // @ts-ignore
    this._or = or_methods[method];
    return this;
  };
});

// @ts-ignore
Q['match'] = function (name: string, col: number, val: string) {
  // @ts-ignore
  return new Q.Binary('MATCH', col, val);
}.bind(null, 'match');

export class DB<Ctx extends object> {
  sqlDb!: Database;

  private inTransaction: boolean = false;
  private transactionCtx: Ctx | undefined;
  private dbName: string = '';

  async init(dbName: string) {
    this.dbName = dbName;

    let SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl,
    });

    let sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());

    SQL.register_for_idb(sqlFS);
    SQL.FS.mkdir('/blocked');
    SQL.FS.mount(sqlFS, {}, '/blocked');

    const path = `/blocked/${dbName}.sqlite`;
    if (typeof SharedArrayBuffer === 'undefined') {
      let stream = SQL.FS.open(path, 'a+');
      await stream.node.contents.readIfFallback();
      SQL.FS.close(stream);
    }

    this.sqlDb = new SQL.Database(`/blocked/${dbName}.sqlite`, {
      filename: true,
    });

    this.sqlDb.exec(`
      PRAGMA journal_mode=MEMORY;
      PRAGMA page_size=8192;
      PRAGMA cache_size=-${10 * 1024};
      PRAGMA foreign_keys=ON;
    `);

    // TODO: migrations
    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${vaultsTable} (
        id varchar(20) PRIMARY KEY,
        name varchar(255) NOT NULL,
        updatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `);

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS incrementTable (value INT, tableName TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_incrementTable ON incrementTable(tableName);
      INSERT OR IGNORE INTO incrementTable VALUES (0, '${clientChangesTable}');
    `);

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${notesTable} (
        id varchar(20) PRIMARY KEY,
        title varchar(255) NOT NULL,
        dailyNoteDate INTEGER,
        rootBlockId varchar(20) NOT NULL,
        updatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_title ON ${notesTable}(title);
      CREATE INDEX IF NOT EXISTS idx_notes_date ON ${notesTable}(dailyNoteDate);
    `);

    this.sqlDb.exec(`
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

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${blocksScopesTable} (
        id varchar(100) PRIMARY KEY,
        collapsedBlockIds TEXT NOT NULL,
        noteId varchar(20) NOT NULL,
        rootBlockId varchar(20) NOT NULL,
        scopedModelId varchar(50) NOT NULL,
        scopedModelType varchar(50) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${blocksScopesTable}_noteId ON ${blocksScopesTable}(noteId);
    `);

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${noteBlocksNotesTable} (
        noteId varchar(20) NOT NULL,
        noteBlockId varchar(20) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_note_blocks_noteId ON ${noteBlocksNotesTable}(noteId);
      CREATE INDEX IF NOT EXISTS idx_notes_note_blocks_noteBlockId ON ${noteBlocksNotesTable}(noteBlockId);
    `);

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${noteBlocksTable} (
        id varchar(20) PRIMARY KEY,
        noteId varchar(20) NOT NULL,
        noteBlockIds TEXT NOT NULL,
        linkedNoteIds TEXT NOT NULL,
        content TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_note_blocks_noteId ON ${noteBlocksTable}(noteId);
    `);

    this.sqlDb.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${noteBlocksFTSTable} USING fts5(id UNINDEXED, textContent, tokenize="trigram");
    `);

    this.sqlDb.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${notesFTSTable} USING fts5(id UNINDEXED, title, tokenize="trigram");
    `);

    const sql = `
      CREATE TRIGGER IF NOT EXISTS populateNoteBlocksNotesTable_insert AFTER INSERT ON ${noteBlocksTable} BEGIN
        INSERT INTO ${noteBlocksNotesTable}(noteId, noteBlockId) SELECT j.value, new.id FROM json_each(new.linkedNoteIds) AS j;
      END;

      -- after delete trigger on notes table is not required cause noteBlocks table is source of truth
      CREATE TRIGGER IF NOT EXISTS populateNoteBlocksNotesTable_deleteBlock AFTER DELETE ON ${noteBlocksTable} BEGIN
        DELETE FROM ${noteBlocksNotesTable} WHERE noteBlockId = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS populateNoteBlocksNotesTable_update AFTER UPDATE ON ${noteBlocksTable} BEGIN
        DELETE FROM ${noteBlocksNotesTable} WHERE noteBlockId = old.id;
        INSERT INTO ${noteBlocksNotesTable}(noteId, noteBlockId) SELECT j.value, new.id FROM json_each(new.linkedNoteIds) AS j;
      END;
    `;

    this.sqlDb.exec(sql);

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${syncStatusTable} (
        id varchar(20) PRIMARY KEY,
        lastReceivedRemoteRevision INTEGER,
        lastAppliedRemoteRevision INTEGER,
        clientId varchar(36) NOT NULL
      )
    `);

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${serverChangesPullsTable} (
        id varchar(36) PRIMARY KEY,
        serverRevision INTEGER NOT NULL
      );
    `);

    this.sqlDb.exec(`
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

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS health_check (
        id INTEGER PRIMARY KEY,
        isOk BOOLEAN NOT NULL CHECK (isOk IN (0, 1))
      );

      INSERT OR REPLACE INTO health_check VALUES (1, 1);
    `);
  }

  transaction<T extends any>(func: () => T, ctx?: Ctx): T {
    if (this.inTransaction) {
      return ctx ? shareCtx(func, ctx) : func();
    }

    this.inTransaction = true;

    this.sqlDb.run('BEGIN TRANSACTION;');

    let result: T | undefined = undefined;

    try {
      result = ctx ? shareCtx(func, ctx) : func();

      this.sqlDb.run('COMMIT;');
    } catch (e) {
      this.sqlDb.run('ROLLBACK;');

      throw e;
    } finally {
      this.inTransaction = false;
    }

    return result;
  }

  sqlExec(sql: string, params?: BindParams): QueryExecResult[] {
    try {
      const startTime = performance.now();
      const res = this.sqlDb.exec(sql, params);
      const end = performance.now();

      console.debug(
        `[${this.dbName}] Done executing`,
        sql,
        params,
        `Time: ${((end - startTime) / 1000).toFixed(4)}s`,
      );

      return res;
    } catch (e) {
      console.log(`[${this.dbName}] Failed execute`, sql, params);
      throw e;
    }
  }

  insertRecords(
    table: string,
    objs: Record<string, any>[],
    replace: boolean = false,
  ) {
    // sqlite max vars = 32766
    // Let's take table columns count to 20, so 20 * 1000 will fit the restriction
    chunk(objs, 1000).forEach((chunkObjs) => {
      let query = Q.insertInto(table).values(chunkObjs);

      if (replace) {
        query = query.orReplace();
      }

      const sql = query.toParams();

      this.sqlExec(sql.text, sql.values);
    });
  }

  // TODO: add mapper for better performance
  getRecords<T extends Record<string, any>>(query: Q.Statement): T[] {
    const sql = query.toParams();

    const [result] = this.sqlExec(sql.text, sql.values);

    return (result?.values?.map((res) => {
      let obj: Record<string, any> = {};

      result.columns.forEach((col, i) => {
        obj[col] = res[i];
      });

      return obj;
    }) || []) as T[];
  }

  execQuery(query: Q.Statement) {
    const sql = query.toParams();

    return this.sqlExec(sql.text, sql.values);
  }
}
