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
import { migrationsTable } from './DB';
import { Subject } from 'rxjs';

class DB {
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

type IStartTransactionCommand = {
  type: 'startTransaction';
  transactionId: string;
  commandId: string;
};
type ICommitTransactionCommand = {
  type: 'commitTransaction';
  transactionId: string;
  commandId: string;
};
type IExecQueryCommand = {
  type: 'execQuery';
  query: Q.SqlBricksParam;
  transactionId?: string;
  commandId: string;
};

export type ICommand =
  | IStartTransactionCommand
  | IExecQueryCommand
  | ICommitTransactionCommand;

type IResponse = {
  commandId: string;
  transactionId?: string;
} & (
  | {
      status: 'success';
      result: QueryExecResult[];
    }
  | {
      status: 'error';
      message: string;
    }
);

// Fix:
// 1. When transaction failed we should discard all future queries with the same
//    transactionId
class CommandsExecutor {
  private queue: ICommand[] = [];
  private currentTransactionId?: string;
  response$: Subject<IResponse> = new Subject();

  constructor(private db: DB) {}

  exec(command: ICommand) {
    this.runCommand(command);

    // TODO: optimize it. We can await for commit, for example
    const queue = this.queue;
    this.queue = [];

    queue.forEach((com) => {
      this.runCommand(com);
    });
  }

  private runCommand(command: ICommand) {
    if (command.type === 'startTransaction') {
      this.startTransaction(command);
    } else if (command.type === 'commitTransaction') {
      this.commitTransaction(command);
    } else if (command.type === 'execQuery') {
      this.execQuery(command);
    }
  }

  private execQuery(command: IExecQueryCommand) {
    if (
      this.currentTransactionId &&
      (!command.transactionId ||
        command.transactionId !== this.currentTransactionId)
    ) {
      this.queue.push(command);
      return;
    }

    this.response$.next(
      this.sqlExec(command.commandId, command.query.text, command.query.values),
    );
  }

  private startTransaction(command: IStartTransactionCommand) {
    if (this.currentTransactionId) {
      this.queue.push(command);
    } else {
      this.currentTransactionId = command.transactionId;

      this.response$.next(
        this.sqlExec(command.commandId, 'BEGIN TRANSACTION;'),
      );
    }
  }

  private commitTransaction(command: ICommitTransactionCommand) {
    if (!this.currentTransactionId)
      throw new Error("Can't commit not running transaction");

    if (this.currentTransactionId === command.transactionId) {
      this.response$.next(this.sqlExec(command.commandId, 'COMMIT;'));
    } else {
      this.queue.push(command);
    }
  }

  private sqlExec(
    commandId: string,
    sql: string,
    params?: BindParams,
  ): IResponse {
    try {
      const res = this.db.sqlExec(sql, params);
      return { commandId, status: 'success', result: res };
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

export type IOutputWorkerMessage =
  | { type: 'initialized' }
  | { type: 'response'; data: IResponse };

export type IInputWorkerMessage =
  | { type: 'initialize'; dbName: string }
  | { type: 'command'; data: ICommand };

let commandsExecutor: CommandsExecutor | undefined;

ctx.addEventListener('message', async (event) => {
  const postMessage = (m: IOutputWorkerMessage) => ctx.postMessage(m);

  const data: IInputWorkerMessage = event.data;

  if (data.type === 'initialize') {
    if (commandsExecutor) {
      console.error('DB already initialized!');

      return;
    }

    const db = new DB(data.dbName);

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
