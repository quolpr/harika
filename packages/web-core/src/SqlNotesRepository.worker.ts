import initSqlJs, { Database } from '@jlongster/sql.js';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';
import { expose, proxy } from 'comlink';
import {
  deleteFrom,
  insert,
  select,
  Statement,
  in as $in,
  eq,
  update,
} from 'sql-bricks';
import type {
  IDatabaseChange,
  NoteBlockDocType,
  NoteDocType,
} from './dexieTypes';
import { DatabaseChangeType } from './dexieTypes';
import { v4 as uuidv4 } from 'uuid';
import { getObjectDiff } from './dexie-sync/utils';

// eslint-disable-next-line no-restricted-globals
// const ctx: Worker = self as any;

const notesTable = 'notes' as const;
const noteBlocksTable = 'noteBlocks' as const;
const changesToSendTable = 'changesToSend' as const;

type IBaseChangeRow = {
  id: string;
  key: string;
  obj: string;
  inTable: string;
};

type ICreateChangeRow = IBaseChangeRow & {
  type: DatabaseChangeType.Create;
};

type IUpdateChangeRow = IBaseChangeRow & {
  type: DatabaseChangeType.Update;
  changeFrom: string;
  changeTo: string;
};

type IDeleteChangeRow = IBaseChangeRow & {
  type: DatabaseChangeType.Delete;
};

type IChangeRow = ICreateChangeRow | IUpdateChangeRow | IDeleteChangeRow;

interface ICtx {
  windowId: string;
  shouldRecordChange: boolean;
  source: 'inDomainChanges' | 'inDbChanges';
}

let currentCtx: ICtx | undefined;
const shareCtx = <T extends any>(func: () => T, ctx: ICtx) => {
  const prevCtx = currentCtx;
  currentCtx = ctx;

  const result = func();

  currentCtx = prevCtx;

  return result;
};
const getCtxStrict = (): ICtx => {
  if (currentCtx === undefined) throw new Error('Ctx not set!');

  return currentCtx;
};

type IExtendedDatabaseChange = IDatabaseChange & {
  windowId: string;
  source: 'inDomainChanges' | 'inDbChanges';
};

class DB {
  sqlDb!: Database;

  private inTransaction: boolean = false;
  private transactionCtx: ICtx | undefined;

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

  transaction<T extends any>(func: () => T, ctx?: ICtx): T {
    if (this.inTransaction) return func();

    this.sqlDb.run('BEGIN TRANSACTION;');

    let result: T | undefined = undefined;

    try {
      result = ctx ? shareCtx(func, ctx) : func();

      this.sqlDb.run('COMMIT;');
    } catch (e) {
      this.sqlDb.run('ROLLBACK;');

      throw e;
    }

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

    this.sqlDb.exec(sql.text, sql.values);
  }

  // TODO: add mapper for better performance
  getRecords<T extends Record<string, any>>(query: Statement): T[] {
    const sql = query.toParams();

    const [result] = this.sqlDb.exec(sql.text, sql.values);

    return result.values.map((res) => {
      let obj: Record<string, any> = {};

      result.columns.forEach((col, i) => {
        obj[col] = res[i];
      });

      return obj;
    }) as T[];
  }

  execQuery(query: Statement) {
    const sql = query.toParams();

    return this.sqlDb.exec(sql.text, sql.values);
  }
}

class SyncRepository {
  constructor(
    private db: DB,
    private onChange: (ch: IExtendedDatabaseChange) => void,
  ) {}

  createCreateChange(table: string, data: Record<string, unknown>) {
    const ctx = getCtxStrict();
    const id = uuidv4();

    this.onChange({
      id,
      type: DatabaseChangeType.Create,
      table,
      key: data.id as string,
      obj: data,
      windowId: ctx.windowId,
      source: ctx.source,
    });

    if (ctx.shouldRecordChange) {
      const changeRow: ICreateChangeRow = {
        id,
        type: DatabaseChangeType.Create,
        inTable: table,
        key: data.id as string,
        obj: JSON.stringify(data),
      };

      this.db.insertRecord(changesToSendTable, changeRow);
    }
  }

  createUpdateChange(
    table: string,
    from: Record<string, unknown>,
    to: Record<string, unknown>,
  ) {
    const ctx = getCtxStrict();
    const id = uuidv4();
    const diff = getObjectDiff(from, to);

    this.onChange({
      id,
      type: DatabaseChangeType.Update,
      table,
      key: from.id as string,
      obj: to,
      from,
      to,
      windowId: ctx.windowId,
      source: ctx.source,
    });

    if (ctx.shouldRecordChange) {
      const change: IUpdateChangeRow = {
        id,
        type: DatabaseChangeType.Update,
        inTable: table,
        key: from.id as string,
        changeFrom: JSON.stringify(diff.from),
        changeTo: JSON.stringify(diff.to),
        obj: JSON.stringify(to),
      };

      this.db.insertRecord(changesToSendTable, change);
    }
  }

  createDeleteChange(table: string, obj: Record<string, unknown>) {
    const ctx = getCtxStrict();
    const id = uuidv4();

    this.onChange({
      id,
      type: DatabaseChangeType.Delete,
      table,
      key: obj.id as string,
      obj,
      windowId: ctx.windowId,
      source: ctx.source,
    });

    if (ctx.shouldRecordChange) {
      const change: IDeleteChangeRow = {
        id,
        type: DatabaseChangeType.Delete,
        inTable: table,
        key: obj.id as string,
        obj: JSON.stringify(obj),
      };

      this.db.insertRecord(changesToSendTable, change);
    }
  }

  getChangesPulls() {}
  getChangesFromServer(ids: string[]) {}
  getChangesToSend() {
    return this.db.getRecords<IChangeRow>(select().from(changesToSendTable));
  }

  deletePulls(ids: string[]) {}
  deleteChangesToSend(ids: string[]) {
    this.db.execQuery(
      deleteFrom().from(changesToSendTable),
      // .where($in('id', ...ids)),
    );
  }
}

class SyncService {
  constructor(private db: DB) {}

  applyServerChanges() {}
}

abstract class BaseSyncRepository<
  T extends Record<string, unknown> & { id: string },
> {
  constructor(protected syncRepository: SyncRepository, protected db: DB) {}

  getById(id: string): T | undefined {
    return this.db.getRecords<T>(
      select().from(this.getTableName()).where(eq('id', id)),
    )[0];
  }

  create(attrs: T, ctx: ICtx) {
    console.log('hey!');

    const result = this.db.transaction(() => {
      this.syncRepository.createCreateChange(this.getTableName(), attrs);

      return this.db.insertRecord(this.getTableName(), attrs);
    }, ctx);

    return result;
  }

  update(changeTo: T, ctx: ICtx) {
    return this.db.transaction(() => {
      const currentRecord = this.getById(changeTo.id);

      if (!currentRecord)
        throw new Error(
          `Couldn't update. ${this.getTableName()}=${changeTo.id} not found`,
        );

      this.syncRepository.createUpdateChange(
        this.getTableName(),
        currentRecord,
        changeTo,
      );

      this.db.execQuery(
        update(this.getTableName())
          .set(changeTo)
          .where(eq('id', currentRecord.id)),
      );
    }, ctx);
  }

  delete(changeTo: NoteBlockDocType, ctx: ICtx) {
    return this.db.transaction(() => {
      const currentRecord = this.getById(changeTo.id);

      if (!currentRecord)
        throw new Error(
          `Couldn't delete. ${this.getTableName()}=${changeTo.id} not found`,
        );

      this.syncRepository.createDeleteChange(
        this.getTableName(),
        currentRecord,
      );
      this.db.execQuery(
        deleteFrom(this.getTableName()).where(eq('id', currentRecord.id)),
      );
    }, ctx);
  }

  getAll() {
    return this.db.getRecords<T>(select().from(this.getTableName()));
  }

  abstract getTableName(): string;
}

class SqlNotesBlocksRepository extends BaseSyncRepository<NoteBlockDocType> {
  getTableName() {
    return noteBlocksTable;
  }
}

class SqlNotesRepository extends BaseSyncRepository<NoteDocType> {
  getTableName() {
    return notesTable;
  }
}

class VaultService {
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
  private syncRepo!: SyncRepository;

  async initialize(
    vaultId: string,
    onChange: (ch: IExtendedDatabaseChange) => void,
  ) {
    console.log('yep');
    if (!this.db) {
      this.db = new DB();
      await this.db.init(vaultId);

      this.syncRepo = new SyncRepository(this.db, onChange);
    }
  }

  getNotesRepo() {
    return proxy(new SqlNotesRepository(this.syncRepo, this.db));
  }

  getSyncRepo() {
    return proxy(this.syncRepo);
  }
}

console.log('hhuuu!!');

expose(VaultWorker);
