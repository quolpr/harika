import initSqlJs, {
  BindParams,
  Database,
  QueryExecResult,
} from '@jlongster/sql.js';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';
import { expose, proxy } from 'comlink';
import Q from 'sql-bricks';
import type {
  IDatabaseChange,
  NoteBlockDocType,
  NoteDocType,
} from './dexieTypes';
import { DatabaseChangeType } from './dexieTypes';
import { v4 as uuidv4 } from 'uuid';
import { getObjectDiff } from './dexie-sync/utils';
import { BroadcastChannel } from 'broadcast-channel';
import { buffer, debounceTime, Subject } from 'rxjs';
import { mapValues } from 'lodash-es';
import dayjs from 'dayjs';

// eslint-disable-next-line no-restricted-globals
// const ctx: Worker = self as any;

const notesTable = 'notes' as const;
const noteBlocksTable = 'noteBlocks' as const;
const noteBlocksNotesTable = 'noteBlocksNotes' as const;
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

export type NoteRowType = {
  id: string;
  title: string;
  dailyNoteDate: number | null;
  createdAt: number;
  updatedAt: number | null;
};

export type NoteBlockRowType = {
  id: string;
  noteId: string;
  isRoot: 0 | 1;
  // TODO: make separate table
  noteBlockIds: string;
  // TODO: make separate table
  linkedNoteIds: string;
  content: string;
  createdAt: number;
  updatedAt: number | null;
};

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

export type IExtendedDatabaseChange = IDatabaseChange & {
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
      PRAGMA page_size=8192;
      PRAGMA cache_size=-${10 * 1024};
    `);

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${notesTable} (
        id varchar(20) PRIMARY KEY,
        title varchar(255) NOT NULL,
        dailyNoteDate INTEGER,
        updatedAt INTEGER,
        createdAt INTEGER NOT NULL
      );
    `);
    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${notesTable} (
        id varchar(20) PRIMARY KEY,
        title varchar(255) NOT NULL,
        dailyNoteDate INTEGER,
        updatedAt INTEGER,
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

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${noteBlocksNotesTable} (
        noteId varchar(20) NOT NULL,
        noteBlockId varchar(20) NOT NULL
      )
    `);

    this.sqlDb.exec(`
      CREATE TABLE IF NOT EXISTS ${noteBlocksTable} (
        id varchar(20) PRIMARY KEY,
        noteId varchar(20) NOT NULL,
        isRoot BOOLEAN NOT NULL CHECK (isRoot IN (0, 1)),
        noteBlockIds TEXT NOT NULL,
        linkedNoteIds TEXT NOT NULL,
        content TEXT NOT NULL,
        updatedAt INTEGER,
        createdAt INTEGER NOT NULL
      );
    `);

    const sql = `
      CREATE TRIGGER IF NOT EXISTS populateNoteBlocksNotesTable_insert AFTER INSERT ON ${noteBlocksTable} BEGIN
        INSERT INTO ${noteBlocksNotesTable}(noteId, noteBlockId) SELECT j.value, new.id FROM json_each(new.linkedNoteIds) AS j;
      END;

      CREATE TRIGGER IF NOT EXISTS populateNoteBlocksNotesTable_deleteBlock AFTER DELETE ON ${noteBlocksTable} BEGIN
        DELETE FROM ${noteBlocksNotesTable} WHERE noteBlockId = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS populateNoteBlocksNotesTable_deleteNote AFTER DELETE ON ${notesTable} BEGIN
        DELETE FROM ${noteBlocksNotesTable} WHERE noteId = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS populateNoteBlocksNotesTable_update AFTER UPDATE ON ${noteBlocksTable} BEGIN
        DELETE FROM ${noteBlocksNotesTable} WHERE noteBlockId = old.id;
        INSERT INTO ${noteBlocksNotesTable}(noteId, noteBlockId) SELECT j.value, new.id FROM json_each(new.linkedNoteIds) AS j;
      END;
    `;

    this.sqlDb.exec(sql);
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

  private sqlExec(sql: string, params?: BindParams): QueryExecResult[] {
    const startTime = performance.now();
    const res = this.sqlDb.exec(sql, params);
    const end = performance.now();

    console.debug(
      'Done executing',
      sql,
      params,
      `Time: ${((end - startTime) / 1000).toFixed(4)}s`,
    );

    return res;
  }

  insertRecord(table: string, obj: Record<string, any>) {
    const values = Object.entries(obj).map(([k, v]) => [
      k,
      v === undefined ? null : v,
    ]);

    const sql = Q.insert(
      table,
      values.map(([k]) => k),
    )
      .values(values.map(([, v]) => v))
      .toParams();

    return this.sqlExec(sql.text, sql.values);
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
      from: diff.from,
      to: diff.to,
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
    return this.db.getRecords<IChangeRow>(Q.select().from(changesToSendTable));
  }

  deletePulls(ids: string[]) {}
  deleteChangesToSend(ids: string[]) {
    this.db.execQuery(
      Q.deleteFrom().from(changesToSendTable).where(Q.in('id', ids)),
    );
  }
}

class SyncService {
  constructor(private db: DB) {}

  applyServerChanges() {}
}

export abstract class BaseSyncRepository<
  Doc extends Record<string, unknown> & { id: string },
  Row extends Record<string, unknown> & { id: string },
> {
  constructor(protected syncRepository: SyncRepository, protected db: DB) {}

  findBy(obj: Partial<Doc>): Doc | undefined {
    const row = this.db.getRecords<Row>(
      Q.select().from(this.getTableName()).where(obj),
    )[0];

    return row ? this.toModel(row) : undefined;
  }

  getByIds(ids: string[]): Doc[] {
    return this.db
      .getRecords<Row>(
        Q.select().from(this.getTableName()).where(Q.in('id', ids)),
      )
      .map((row) => this.toModel(row));
  }

  getById(id: string): Doc | undefined {
    return this.findBy({ id } as Partial<Doc>);
  }

  getIsExists(id: string): boolean {
    return this.getById(id) !== undefined;
  }

  create(attrs: Doc, ctx: ICtx) {
    return this.db.transaction(() => {
      this.syncRepository.createCreateChange(this.getTableName(), attrs);

      this.db.insertRecord(this.getTableName(), this.toDoc(attrs));

      return attrs;
    }, ctx);
  }

  update(changeTo: Doc, ctx: ICtx) {
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
        Q.update(this.getTableName())
          .set(this.toDoc(changeTo))
          .where(Q.eq('id', currentRecord.id)),
      );

      return changeTo;
    }, ctx);
  }

  delete(id: string, ctx: ICtx) {
    return this.db.transaction(() => {
      const currentRecord = this.getById(id);

      if (!currentRecord)
        throw new Error(
          `Couldn't delete. ${this.getTableName()}=${id} not found`,
        );

      this.syncRepository.createDeleteChange(
        this.getTableName(),
        currentRecord,
      );
      this.db.execQuery(
        Q.deleteFrom(this.getTableName()).where(Q.eq('id', id)),
      );
    }, ctx);
  }

  getAll() {
    return this.db.getRecords<Doc>(Q.select().from(this.getTableName()));
  }

  toDoc(model: Doc): Row {
    return mapValues(model, (v) => (v === undefined ? null : v)) as Row;
  }

  toModel(row: Row): Doc {
    return row as Doc;
  }

  abstract getTableName(): string;
}

export class SqlNotesBlocksRepository extends BaseSyncRepository<
  NoteBlockDocType,
  NoteBlockRowType
> {
  getByNoteIds(ids: string[]) {
    console.log({ ids });
    const res = this.db.getRecords<NoteBlockRowType>(
      Q.select().from(this.getTableName()).where(Q.in('noteId', ids)),
    );

    return res?.map((res) => this.toModel(res)) || [];
  }

  getByNoteId(id: string): NoteBlockDocType[] {
    return this.getByNoteIds([id]);
  }

  getTableName() {
    return noteBlocksTable;
  }

  getLinkedNoteIdsOfNoteId(id: string): string[] {
    const [res] = this.db.execQuery(
      Q.select()
        .distinct('joined.noteId')
        .from(noteBlocksNotesTable)
        .leftJoin(`${this.getTableName()} joined`, {
          [`${noteBlocksNotesTable}.noteBlockId`]: `joined.id`,
        })
        .where({ [`${noteBlocksNotesTable}.noteId`]: id }),
    );

    return res?.values?.map(([val]) => val as string) || [];
  }

  toDoc(model: NoteBlockDocType): NoteBlockRowType {
    return {
      ...super.toDoc(model),
      noteBlockIds: JSON.stringify(model.noteBlockIds),
      linkedNoteIds: JSON.stringify(model.linkedNoteIds),
      isRoot: model.isRoot ? 1 : 0,
    };
  }

  toModel(row: NoteBlockRowType): NoteBlockDocType {
    return {
      ...super.toModel(row),
      noteBlockIds: JSON.parse(row['noteBlockIds'] as string),
      linkedNoteIds: JSON.parse(row['linkedNoteIds'] as string),
      isRoot: Boolean(row.isRoot),
    } as NoteBlockDocType;
  }
}

export class SqlNotesRepository extends BaseSyncRepository<
  NoteDocType,
  NoteRowType
> {
  // TODO: move to getBy
  getByTitles(titles: string[]): NoteDocType[] {
    return this.db
      .getRecords<NoteDocType>(
        Q.select().from(this.getTableName()).where(Q.in('title', titles)),
      )
      .map((row) => this.toModel(row));
  }

  findInTitle(title: string): NoteDocType[] {
    return this.db
      .getRecords<NoteDocType>(
        Q.select()
          .from(this.getTableName())
          .where(Q.like('title', `%${title}%`)),
      )
      .map((row) => this.toModel(row));
  }

  getIsExistsByTitle(title: string): boolean {
    return this.findBy({ title }) !== undefined;
  }

  getDailyNote(date: number) {
    const startOfDate = dayjs(date).startOf('day');

    return this.findBy({ dailyNoteDate: startOfDate.unix() * 1000 });
  }

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
  private eventsSubject$: Subject<IExtendedDatabaseChange> = new Subject();

  constructor(private dbName: string) {
    const eventsChannel = new BroadcastChannel(this.dbName, {
      webWorkerSupport: true,
    });

    this.eventsSubject$
      .pipe(buffer(this.eventsSubject$.pipe(debounceTime(200))))
      .subscribe((e) => {
        eventsChannel.postMessage(e);
      });
  }

  async initialize() {
    if (!this.db) {
      this.db = new DB();
      await this.db.init(this.dbName);

      this.syncRepo = new SyncRepository(this.db, (e) =>
        this.eventsSubject$.next(e),
      );
    }
  }

  getNotesRepo() {
    return proxy(new SqlNotesRepository(this.syncRepo, this.db));
  }

  getNotesBlocksRepo() {
    return proxy(new SqlNotesBlocksRepository(this.syncRepo, this.db));
  }

  getSyncRepo() {
    return proxy(this.syncRepo);
  }
}

expose(VaultWorker);
