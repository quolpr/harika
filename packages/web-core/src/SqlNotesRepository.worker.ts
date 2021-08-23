import initSqlJs, { BindParams, Database } from '@jlongster/sql.js';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';
import { expose, proxy } from 'comlink';
import { snakeCase } from 'lodash-es';
import { insert, select } from 'sql-bricks';
import type { NoteBlockDocType, NoteDocType } from './dexieTypes';
import { DatabaseChangeType } from './dexieTypes';
import { v4 as uuidv4 } from 'uuid';

// eslint-disable-next-line no-restricted-globals
// const ctx: Worker = self as any;

const notesTable = 'notes' as const;
const noteBlocksTable = 'noteBlocks' as const;

const changesToSendTable = 'changesToSend' as const;

interface IChangeRow {
  id: string;
  type: DatabaseChangeType;
  inTable: typeof noteBlocksTable | typeof notesTable;
  key: string;
  obj: string;
  changeFrom?: string;
  changeTo?: string;
}

class DB {
  sqlDb!: Database;

  private inTransaction: boolean = false;

  async init(vaultId: string) {
    let SQL = await initSqlJs({
      locateFile: (file: string) => `/sqljs/${file}`,
    });

    let sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());

    SQL.register_for_idb(sqlFS);
    SQL.FS.mkdir('/blocked');
    SQL.FS.mount(sqlFS, {}, '/blocked');

    this.sqlDb = new SQL.Database(`/blocked/${vaultId}.sqlite`, {
      filename: true,
    });

    this.sqlDb.exec(`
      PRAGMA journal_mode=MEMORY;
    `);

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${notesTable} (
        id varchar(20) PRIMARY KEY,
        title varchar(255) NOT NULL,
        dailyNoteDate INTEGER,
        createdAt INTEGER NOT NULL
      );
    `);

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${changesToSendTable} (
        id varchar(36) PRIMARY KEY,
        type varchar(10) NOT NULL,
        inTable varchar(10) NOT NULL,
        key varchar(36) NOT NULL,
        obj TEXT NOT NULL,
        changeFrom TEXT,
        changeTo TEXT
      );
    `);
  }

  transaction<T extends any>(func: () => T): T {
    if (this.inTransaction) return func();

    this.sqlDb.run('BEGIN TRANSACTION;');

    const result = func();

    this.sqlDb.run('COMMIT');

    return result;
  }

  insertRecord(table: string, obj: Record<string, any>) {
    const values = Object.entries(obj).map(([k, v]) => [
      k,
      v === undefined ? null : v,
    ]);

    const sql = insert(
      table,
      values.map(([k]) => k),
    )
      .values(values.map(([, v]) => v))
      .toParams();

    console.log({ sql });

    console.log(this.sqlDb.exec(sql.text, sql.values));
  }

  getRecords<T extends Record<string, any>>(
    sql: string,
    params?: BindParams,
    mapper?: () => T,
  ) {
    const [result] = this.sqlDb.exec(sql, params);

    return result.values.map((res) => {
      const obj: Record<string, any> = {};

      result.columns.forEach((col, i) => {
        obj[col] = res[i];
      });

      return obj;
    }) as T[];
  }
}

export class SyncRepository {
  constructor(private db: DB) {}

  createCreateChange(
    table: IChangeRow['inTable'],
    data: Record<string, unknown>,
  ) {
    const change: IChangeRow = {
      id: uuidv4(),
      type: DatabaseChangeType.Create,
      inTable: table,
      key: data.id as string,
      obj: JSON.stringify(data),
    };

    this.db.insertRecord(changesToSendTable, change);
  }

  getChangesPulls() {}
  getChangesFromServer(ids: string[]) {}
  getChangesToSend() {
    return this.db.getRecords<IChangeRow>(
      select().from(changesToSendTable).toString(),
    );
  }

  deletePulls(ids: string[]) {}
  deleteChangesToSend(ids: string[]) {
    return this.db.getRecords<IChangeRow>(
      select().from(changesToSendTable).toString(),
    );
  }
}

export class SyncService {
  constructor(private db: DB) {}

  applyServerChanges() {}
}

export class SqlNotesBlocksRepository {
  constructor(private syncRepository: SyncRepository, private db: DB) {}

  create(attrs: NoteBlockDocType) {
    //start transaction
    this.syncRepository.createCreateChange(notesTable, attrs);

    // this.db call

    //end transaction
  }
  getById(id: string): NoteBlockDocType {}
  getRootBlock(id: string): NoteBlockDocType {}
}

export class SqlNotesRepository {
  constructor(private syncRepository: SyncRepository, private db: DB) {}

  create(attrs: NoteDocType) {
    return this.db.transaction(() => {
      this.syncRepository.createCreateChange(notesTable, attrs);

      return this.db.insertRecord(notesTable, attrs);
    });
  }

  getAll() {
    console.log(select().from(notesTable).toString());

    return this.db.getRecords<NoteDocType>(
      select().from(notesTable).toString(),
    );
  }
}

export class VaultService {
  constructor(
    private notesRepository: SqlNotesRepository,
    private notesBlocksRepository: SqlNotesBlocksRepository,
    private db: DB,
  ) {}

  createNoteAndBlocks() {
    //start transaction
    //end transaction
  }
}

export class VaultWorker {
  private db!: DB;

  async initialize(vaultId: string) {
    if (!this.db) {
      this.db = new DB();
      await this.db.init(vaultId);
    }
  }

  notesRepo() {
    const syncRepo = new SyncRepository(this.db);

    return proxy(new SqlNotesRepository(syncRepo, this.db));
  }

  syncRepo() {
    return proxy(new SyncRepository(this.db));
  }
}

expose(VaultWorker);
