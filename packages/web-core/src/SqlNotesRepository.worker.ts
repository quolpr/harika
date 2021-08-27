import initSqlJs, {
  BindParams,
  Database,
  QueryExecResult,
} from '@jlongster/sql.js';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';
import { proxy, ProxyMarked } from 'comlink';
import Q from 'sql-bricks';
import type {
  ICreateChange,
  IDeleteChange,
  IUpdateChange,
  NoteBlockDocType,
  NoteDocType,
} from './dexieTypes';
import { DatabaseChangeType } from './dexieTypes';
import { v4 as uuidv4 } from 'uuid';
import { getObjectDiff } from './dexie-sync/utils';
import { BroadcastChannel } from 'broadcast-channel';
import { buffer, debounceTime, Subject } from 'rxjs';
import { mapValues, maxBy } from 'lodash-es';
import dayjs from 'dayjs';
import { v4 } from 'uuid';
import type { IChangesApplier } from './dexie-sync/ServerSynchronizer';
import type { Overwrite, Required } from 'utility-types';

// eslint-disable-next-line no-restricted-globals
// const ctx: Worker = self as any;

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

const notesTable = 'notes' as const;
const noteBlocksTable = 'noteBlocks' as const;
const noteBlocksNotesTable = 'noteBlocksNotes' as const;

//

const clientChangesTable = 'clientChanges' as const;
const syncStatusTable = 'syncStatus' as const;
const serverChangesPullsTable = 'serverChangesPulls' as const;
const serverChangesTable = 'serverChanges' as const;

//

export const vaultsTable = 'vaultsTable' as const;

type IBaseClientChangeRow = {
  id: string;
  key: string;
  obj: string;
  inTable: string;
  rev: number;
};

type ICreateClientChangeRow = IBaseClientChangeRow & {
  type: DatabaseChangeType.Create;
  changeFrom: null;
  changeTo: null;
};

type IUpdateClientChangeRow = IBaseClientChangeRow & {
  type: DatabaseChangeType.Update;
  changeFrom: string;
  changeTo: string;
};

type IDeleteClientChangeRow = IBaseClientChangeRow & {
  type: DatabaseChangeType.Delete;
  changeFrom: null;
  changeTo: null;
};

type IClientChangeRow =
  | ICreateClientChangeRow
  | IUpdateClientChangeRow
  | IDeleteClientChangeRow;

type ICreateClientChangeDoc = ICreateChange & { rev: number };
type IUpdateClientChangeDoc = Required<IUpdateChange, 'obj'> & { rev: number };
type IDeleteClientChangeDoc = IDeleteChange & { rev: number };

type IClientChangeDoc =
  | ICreateClientChangeDoc
  | IUpdateClientChangeDoc
  | IDeleteClientChangeDoc;

export type ITransmittedCreateChange = ICreateChange & IChangeExtended;
export type ITransmittedUpdateChange = IUpdateChange & IChangeExtended;
export type ITransmittedDeleteChange = IDeleteChange & IChangeExtended;

export type ITransmittedChange =
  | ITransmittedDeleteChange
  | ITransmittedUpdateChange
  | ITransmittedCreateChange;

type ICreateServerChangeRow = ICreateClientChangeRow;
type IUpdateServerChangeRow = Overwrite<IUpdateClientChangeRow, { obj: null }>;
type IDeleteServerChangeRow = IDeleteClientChangeRow;

export type IServerChangeRow = (
  | ICreateServerChangeRow
  | IUpdateServerChangeRow
  | IDeleteServerChangeRow
) & {
  pullId: string;
  rev: number;
};
export type IServerChangeDoc = (
  | ICreateChange
  | Omit<IUpdateChange, 'obj'>
  | IDeleteChange
) & {
  pullId: string;
  rev: number;
};
export type IChangesPullsRow = { id: string; serverRevision: number };

export type NoteRow = {
  id: string;
  title: string;
  dailyNoteDate: number | null;
  createdAt: number;
  updatedAt: number | null;
};

export type NoteBlockRow = {
  id: string;
  noteId: string;
  isRoot: 0 | 1;
  noteBlockIds: string;
  linkedNoteIds: string;
  content: string;
  createdAt: number;
  updatedAt: number | null;
};

export type VaultRow = {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
};

export type VaultDoc = VaultRow;

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
type IChangeExtended = {
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
        isRoot BOOLEAN NOT NULL CHECK (isRoot IN (0, 1)),
        noteBlockIds TEXT NOT NULL,
        linkedNoteIds TEXT NOT NULL,
        content TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_note_blocks_noteId ON ${noteBlocksTable}(noteId);
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
  }

  transaction<T extends any>(func: () => T, ctx?: ICtx): T {
    if (this.inTransaction) return func();

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

  private sqlExec(sql: string, params?: BindParams): QueryExecResult[] {
    try {
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
    } catch (e) {
      console.log('Failed execute', sql, params);
      throw e;
    }
  }

  insertRecords(
    table: string,
    objs: Record<string, any>[],
    replace: boolean = false,
  ) {
    let query = Q.insertInto(table).values(objs);

    if (replace) {
      query = query.orReplace();
    }

    const sql = query.toParams();

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

export interface ISyncStatus {
  id: 1;
  lastReceivedRemoteRevision: number | null;
  lastAppliedRemoteRevision: number | null;
  clientId: string;
}

export class SyncRepository {
  constructor(
    private db: DB,
    private onChange: (ch: ITransmittedChange[]) => void,
  ) {}

  createCreateChanges(table: string, records: Record<string, unknown>[]) {
    this.db.transaction(() => {
      const ctx = getCtxStrict();

      const changeEvents = records.map((data): ITransmittedCreateChange => {
        const id = uuidv4();

        return {
          id,
          type: DatabaseChangeType.Create,
          table,
          key: data.id as string,
          obj: data,
          windowId: ctx.windowId,
          source: ctx.source,
        };
      });

      this.onChange(changeEvents);

      if (ctx.shouldRecordChange) {
        this.db.insertRecords(
          clientChangesTable,
          changeEvents.map((ev): ICreateClientChangeRow => {
            return {
              id: ev.id,
              type: DatabaseChangeType.Create,
              inTable: table,
              key: ev.key,
              obj: JSON.stringify(ev.obj),
              rev: 0,
              changeFrom: null,
              changeTo: null,
            };
          }),
        );
      }
    });
  }

  createUpdateChanges(
    table: string,
    changes: {
      from: Record<string, unknown>;
      to: Record<string, unknown>;
    }[],
  ) {
    this.db.transaction(() => {
      const ctx = getCtxStrict();

      const changeEvents = changes.map((ch): ITransmittedUpdateChange => {
        const id = uuidv4();

        const diff = getObjectDiff(ch.from, ch.to);

        return {
          id,
          type: DatabaseChangeType.Update,
          table,
          key: ch.from.id as string,
          obj: ch.to,
          from: diff.from,
          to: diff.to,
          windowId: ctx.windowId,
          source: ctx.source,
        };
      });

      this.onChange(changeEvents);

      if (ctx.shouldRecordChange) {
        this.db.insertRecords(
          clientChangesTable,
          changeEvents.map((ev): IUpdateClientChangeRow => {
            return {
              id: ev.id,
              type: DatabaseChangeType.Update,
              inTable: table,
              key: ev.key,
              changeFrom: JSON.stringify(ev.from),
              changeTo: JSON.stringify(ev.to),
              obj: JSON.stringify(ev.obj),
              rev: 0,
            };
          }),
        );
      }
    });
  }

  createDeleteChanges(table: string, objs: Record<string, unknown>[]) {
    this.db.transaction(() => {
      const ctx = getCtxStrict();

      const changeEvents = objs.map((obj): ITransmittedDeleteChange => {
        const id = uuidv4();

        return {
          id,
          type: DatabaseChangeType.Delete,
          table,
          key: obj.id as string,
          obj,
          windowId: ctx.windowId,
          source: ctx.source,
        };
      });

      if (ctx.shouldRecordChange) {
        this.db.insertRecords(
          clientChangesTable,
          changeEvents.map((ev): IDeleteClientChangeRow => {
            return {
              id: ev.id,
              type: DatabaseChangeType.Delete,
              inTable: table,
              key: ev.key,
              obj: JSON.stringify(ev.obj),
              rev: 0,
              changeFrom: null,
              changeTo: null,
            };
          }),
        );
      }
    });
  }

  getChangesPulls(): IChangesPullsRow[] {
    return this.db.getRecords<IChangesPullsRow>(
      Q.select().from(serverChangesPullsTable),
    );
  }

  getServerChangesByPullIds(pullIds: string[]): IServerChangeDoc[] {
    return this.db
      .getRecords<IServerChangeRow>(
        Q.select()
          .from(serverChangesTable)
          .where(Q.in('pullId', pullIds))
          .orderBy('rev'),
      )
      .map((row) => this.serverChangeRowToDoc(row));
  }

  getClientChanges() {
    return this.db
      .getRecords<IClientChangeRow>(
        Q.select().from(clientChangesTable).orderBy('rev'),
      )
      .map((row) => this.clientChangeRowToDoc(row));
  }

  bulkDeleteClientChanges(ids: string[]) {
    this.db.execQuery(
      Q.deleteFrom().from(clientChangesTable).where(Q.in('id', ids)),
    );
  }

  deletePulls(ids: string[]) {
    this.db.execQuery(
      Q.deleteFrom().from(serverChangesPullsTable).where(Q.in('id', ids)),
    );
  }

  createPull(pull: IChangesPullsRow, changes: IServerChangeDoc[]) {
    this.db.transaction(() => {
      this.db.execQuery(Q.insertInto(serverChangesPullsTable).values(pull));

      const rows = changes.map((ch): IServerChangeRow => {
        return this.serverChangeDocToRow(ch);
      });

      if (rows.length > 0) {
        this.db.execQuery(Q.insertInto(serverChangesTable).values(rows));
      }

      this.updateSyncStatus({
        lastReceivedRemoteRevision: pull.serverRevision,
      });
    });
  }

  getSyncStatus(): ISyncStatus {
    let status = this.db.getRecords<ISyncStatus>(
      Q.select().from(syncStatusTable).where({ id: 1 }),
    )[0];

    if (!status) {
      status = {
        id: 1,
        lastReceivedRemoteRevision: null,
        lastAppliedRemoteRevision: null,
        clientId: v4(),
      };

      this.db.insertRecords(syncStatusTable, [status]);
    }

    return status;
  }

  updateSyncStatus(status: Partial<ISyncStatus>) {
    this.db.execQuery(Q.update(syncStatusTable).set(status).where({ id: 1 }));
  }

  private clientChangeRowToDoc(ch: IClientChangeRow): IClientChangeDoc {
    const base = {
      id: ch.id,
      key: ch.key,
      table: ch.inTable,
      rev: ch.rev,
    };

    if (ch.type === DatabaseChangeType.Create) {
      return {
        ...base,
        type: DatabaseChangeType.Create,
        obj: JSON.parse(ch.obj),
      };
    } else if (ch.type === DatabaseChangeType.Update) {
      return {
        ...base,
        type: DatabaseChangeType.Update,
        obj: JSON.parse(ch.obj),
        from: JSON.parse(ch.changeFrom),
        to: JSON.parse(ch.changeTo),
      };
    } else {
      return {
        ...base,
        type: DatabaseChangeType.Delete,
        obj: JSON.parse(ch.obj),
      };
    }
  }

  private serverChangeRowToDoc(ch: IServerChangeRow): IServerChangeDoc {
    const base = {
      id: ch.id,
      key: ch.key,
      table: ch.inTable,
      pullId: ch.pullId,
      rev: ch.rev,
    };

    if (ch.type === DatabaseChangeType.Create) {
      return {
        ...base,
        type: DatabaseChangeType.Create,
        obj: JSON.parse(ch.obj),
      };
    } else if (ch.type === DatabaseChangeType.Update) {
      return {
        ...base,
        type: DatabaseChangeType.Update,
        from: JSON.parse(ch.changeFrom),
        to: JSON.parse(ch.changeTo),
      };
    } else {
      return {
        ...base,
        type: DatabaseChangeType.Delete,
        obj: JSON.parse(ch.obj),
      };
    }
  }

  private serverChangeDocToRow(ch: IServerChangeDoc): IServerChangeRow {
    const base = {
      id: ch.id,
      key: ch.key,
      inTable: ch.table,
      pullId: ch.pullId,
      rev: ch.rev,
    };

    if (ch.type === DatabaseChangeType.Create) {
      return {
        ...base,
        type: DatabaseChangeType.Create,
        obj: JSON.stringify(ch.obj),
        changeFrom: null,
        changeTo: null,
      };
    } else if (ch.type === DatabaseChangeType.Update) {
      return {
        ...base,
        type: DatabaseChangeType.Update,
        changeFrom: JSON.stringify(ch.from),
        changeTo: JSON.stringify(ch.to),
        obj: null,
      };
    } else {
      return {
        ...base,
        type: DatabaseChangeType.Delete,
        obj: JSON.stringify(ch.obj),
        changeFrom: null,
        changeTo: null,
      };
    }
  }
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
    return this.bulkCreate([attrs], ctx)[0];
  }

  bulkCreate(attrsArray: Doc[], ctx: ICtx) {
    return this.db.transaction(() => {
      this.syncRepository.createCreateChanges(this.getTableName(), attrsArray);

      this.db.insertRecords(
        this.getTableName(),
        attrsArray.map((attrs) => this.toDoc(attrs)),
      );

      return attrsArray;
    }, ctx);
  }

  update(changeTo: Doc, ctx: ICtx) {
    return this.bulkUpdate([changeTo], ctx)[0];
  }

  bulkUpdate(records: Doc[], ctx: ICtx) {
    return this.db.transaction(() => {
      const prevRecordsMap = Object.fromEntries(
        this.getByIds(records.map(({ id }) => id)).map((prev) => [
          prev.id,
          prev,
        ]),
      );

      const changes = records.map((record) => {
        if (!prevRecordsMap[record.id])
          throw new Error(
            `Prev record for ${JSON.stringify(record)} not found!`,
          );

        return { from: record, to: prevRecordsMap[record.id] };
      });

      this.syncRepository.createUpdateChanges(this.getTableName(), changes);

      // More efficient
      this.db.insertRecords(
        this.getTableName(),
        records.map((r) => this.toDoc(r)),
        true,
      );

      return records;
    }, ctx);
  }

  delete(id: string, ctx: ICtx) {
    this.bulkDelete([id], ctx);
  }

  bulkDelete(ids: string[], ctx: ICtx) {
    return this.db.transaction(() => {
      this.syncRepository.createDeleteChanges(
        this.getTableName(),
        this.getByIds(ids),
      );

      this.db.execQuery(
        Q.deleteFrom(this.getTableName()).where(Q.in('id', ids)),
      );
    });
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
  NoteBlockRow
> {
  getByNoteIds(ids: string[]) {
    console.log({ ids });
    const res = this.db.getRecords<NoteBlockRow>(
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

  toDoc(model: NoteBlockDocType): NoteBlockRow {
    return {
      ...super.toDoc(model),
      noteBlockIds: JSON.stringify(model.noteBlockIds),
      linkedNoteIds: JSON.stringify(model.linkedNoteIds),
      isRoot: model.isRoot ? 1 : 0,
    };
  }

  toModel(row: NoteBlockRow): NoteBlockDocType {
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
  NoteRow
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
    const startOfDate = dayjs.unix(date).startOf('day');

    return this.findBy({ dailyNoteDate: startOfDate.unix() * 1000 });
  }

  getTableName() {
    return notesTable;
  }
}
export class SqlVaultsRepository extends BaseSyncRepository<
  VaultDoc,
  VaultRow
> {
  getTableName() {
    return vaultsTable;
  }
}

export class ApplyChangesService {
  constructor(
    private db: DB,
    private resolver: IChangesApplier,
    private syncRepo: SyncRepository,
  ) {}

  applyChanges() {
    this.db.transaction(() => {
      const syncStatus = this.syncRepo.getSyncStatus();

      const serverPulls = this.syncRepo.getChangesPulls();
      console.log({ serverPulls });
      const serverChanges = this.syncRepo.getServerChangesByPullIds(
        serverPulls.map(({ id }) => id),
      );

      // if (serverChanges.length > 0) {
      //   const clientChanges = this.syncRepo.getClientChanges();

      //   this.resolver.resolveChanges(
      //     clientChanges.map((change) => ({
      //       ...change,
      //       source: syncStatus.clientId,
      //     })),
      //     serverChanges,
      //   );

      //   this.syncRepo.deletePulls(serverPulls.map(({ id }) => id));
      // }

      const maxRevision = maxBy(
        serverPulls,
        ({ serverRevision }) => serverRevision,
      )?.serverRevision;

      console.log({ maxRevision });

      if (maxRevision) {
        this.syncRepo.updateSyncStatus({
          lastAppliedRemoteRevision: maxRevision,
        });
      }
    });
  }
}

export abstract class BaseDbWorker {
  protected db!: DB;
  protected syncRepo!: SyncRepository;
  protected eventsSubject$: Subject<ITransmittedChange[]> = new Subject();

  constructor(private dbName: string) {
    const eventsChannel = new BroadcastChannel(this.dbName, {
      webWorkerSupport: true,
    });

    this.eventsSubject$
      .pipe(buffer(this.eventsSubject$.pipe(debounceTime(200))))
      .subscribe((evs) => {
        eventsChannel.postMessage(evs.flat());
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

  getSyncRepo() {
    return proxy(this.syncRepo);
  }

  abstract getApplyChangesService(): ApplyChangesService & ProxyMarked;
}
