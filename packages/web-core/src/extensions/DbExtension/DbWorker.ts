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
import { getIsLogSuppressing } from './suppressLog';
import { v4 as uuidv4 } from 'uuid';
import {
  ICommand,
  IResponse,
  IExecQueriesCommand,
  IStartTransactionCommand,
  ICommitTransactionCommand,
  IOutputWorkerMessage,
  IInputWorkerMessage,
  migrationsTable,
} from './types';
import { Subject } from 'rxjs';

class DbBackend {
  private sqlDb!: Database;

  constructor(private dbName: string) {}

  async init() {
    let SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl,
    });

    let sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());

    SQL.register_for_idb(sqlFS);
    SQL.FS.mkdir('/blocked');
    SQL.FS.mount(sqlFS, {}, '/blocked');

    const path = `/blocked/${this.dbName}.sqlite`;
    if (typeof SharedArrayBuffer === 'undefined') {
      console.log('No SharedArrayBuffer');
      let stream = SQL.FS.open(path, 'a+');
      await stream.node.contents.readIfFallback();
      SQL.FS.close(stream);
    }

    this.sqlDb = new SQL.Database(`/blocked/${this.dbName}.sqlite`, {
      filename: true,
    });

    this.sqlExec(`
      PRAGMA journal_mode=MEMORY;
      PRAGMA page_size=${32 * 1024};
      PRAGMA cache_size=-${10 * 1024};
      PRAGMA foreign_keys=ON;
    `);

    this.sqlExec(`
      CREATE TABLE IF NOT EXISTS health_check (
        id INTEGER PRIMARY KEY,
        isOk BOOLEAN NOT NULL CHECK (isOk IN (0, 1))
      );

      INSERT OR REPLACE INTO health_check VALUES (1, 1);
    `);

    this.sqlExec(`
      CREATE TABLE IF NOT EXISTS ${migrationsTable} (
        id INTEGER PRIMARY KEY,
        name varchar(20) NOT NULL,
        migratedAt INTEGER NOT NULL
      )
    `);
  }

  sqlExec(sql: string, params?: BindParams): QueryExecResult[] {
    try {
      const startTime = performance.now();
      const res = this.sqlDb.exec(sql, params);
      const end = performance.now();

      if (!getIsLogSuppressing()) {
        console.debug(
          `[${this.dbName}] Done executing`,
          sql,
          params,
          `Time: ${((end - startTime) / 1000).toFixed(4)}s`,
        );
      }

      return res;
    } catch (e) {
      console.error(`[${this.dbName}] Failed execute`, e, sql, params);
      throw e;
    }
  }
}

// Fix:
// 1. When transaction failed we should discard all future queries with the same
//    transactionId
class CommandsExecutor {
  private queue: ICommand[] = [];
  private currentTransactionId?: string;
  response$: Subject<IResponse> = new Subject();

  constructor(private db: DbBackend) {}

  exec(command: ICommand) {
    this.queue.push(command);

    const queue = this.queue;
    this.queue = [];

    // TODO: optimize it. We can await for commit, for example
    queue.forEach((com) => {
      this.runCommand(com);
    });
  }

  private runCommand(command: ICommand) {
    if (command.type === 'startTransaction') {
      this.startTransaction(command);
    } else if (command.type === 'commitTransaction') {
      this.commitTransaction(command);
    } else if (command.type === 'execQueries') {
      this.execQuery(command);
    }
  }

  private execQuery(command: IExecQueriesCommand) {
    if (
      this.currentTransactionId &&
      (!command.transactionId ||
        command.transactionId !== this.currentTransactionId)
    ) {
      this.queue.push(command);
      return;
    }

    this.response$.next(this.sqlExec(command.commandId, command.queries));
  }

  private startTransaction(command: IStartTransactionCommand) {
    if (this.currentTransactionId) {
      this.queue.push(command);
    } else {
      this.currentTransactionId = command.transactionId;

      this.response$.next(
        this.sqlExec(command.commandId, [
          { text: 'BEGIN TRANSACTION;', values: [] },
        ]),
      );
    }
  }

  private commitTransaction(command: ICommitTransactionCommand) {
    if (!this.currentTransactionId)
      throw new Error("Can't commit not running transaction");

    if (this.currentTransactionId === command.transactionId) {
      this.response$.next(
        this.sqlExec(command.commandId, [{ text: 'COMMIT;', values: [] }]),
      );
      this.currentTransactionId = undefined;
    } else {
      this.queue.push(command);
    }
  }

  private sqlExec(
    commandId: string,
    queries: Q.SqlBricksParam[],
    spawnTransaction: boolean = false,
  ): IResponse {
    try {
      const shouldSpawnTransaction =
        spawnTransaction && !this.currentTransactionId;

      if (shouldSpawnTransaction) {
        this.db.sqlExec('BEGIN TRANSACTION');
        this.currentTransactionId = uuidv4();
      }

      const result = queries.map((q) => {
        return this.db.sqlExec(q.text, q.values);
      });

      if (shouldSpawnTransaction) {
        this.db.sqlExec('COMMIT');
        this.currentTransactionId = undefined;
      }

      return {
        commandId,
        status: 'success',
        result,
      };
    } catch (e) {
      if (this.currentTransactionId) {
        this.db.sqlExec('ROLLBACK;');

        this.currentTransactionId = undefined;
      }

      return { commandId, status: 'error', message: (e as Error).message };
    }
  }
}

const ctx: Worker = self as any;

let commandsExecutor: CommandsExecutor | undefined;

ctx.addEventListener('message', async (event) => {
  const postMessage = (m: IOutputWorkerMessage) => ctx.postMessage(m);

  const data: IInputWorkerMessage = event.data;

  if (data.type === 'initialize') {
    if (commandsExecutor) {
      console.error('DB already initialized!');

      return;
    }

    const db = new DbBackend(data.dbName);

    await db.init();

    commandsExecutor = new CommandsExecutor(db);

    postMessage({ type: 'initialized' });

    commandsExecutor.response$.subscribe((r) => {
      postMessage({ type: 'response', data: r });
    });
  } else {
    if (!commandsExecutor) {
      console.error('DB is not initialized');

      return;
    }

    commandsExecutor.exec(event.data.data);
  }
});
