import initSqlJs, {
  BindParams,
  Database,
  QueryExecResult,
} from '@harika-org/sql.js';
// @ts-ignore
import sqlWasmUrl from '@harika-org/sql.js/dist/sql-wasm.wasm?url';
import { SQLiteFS } from 'absurd-sql';
import IndexedDBBackend from 'absurd-sql/dist/indexeddb-backend';
import { Subject } from 'rxjs';
import Q from 'sql-bricks';

import {
  ICommand,
  ICommitTransactionCommand,
  IExecQueriesCommand,
  IInputWorkerMessage,
  IOutputWorkerMessage,
  IResponse,
  IRollbackTransactionCommand,
  IStartTransactionCommand,
  migrationsTable,
} from './types';

const colors = ['yellow', 'cyan', 'magenta'];

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

  private currentTransactionI = 0;
  private currentTransactionId: string | undefined;
  sqlExec(
    sql: string,
    params?: BindParams,
    logOpts?: {
      transactionId?: string;
      suppressLog?: boolean;
    },
  ): QueryExecResult[] {
    try {
      const startTime = performance.now();
      const res = this.sqlDb.exec(sql, params);
      const end = performance.now();

      if (
        logOpts?.transactionId &&
        logOpts.transactionId !== this.currentTransactionId &&
        !logOpts.suppressLog
      ) {
        this.currentTransactionId = logOpts.transactionId;
        this.currentTransactionI++;
      }
      if (!logOpts?.transactionId) {
        this.currentTransactionId = undefined;
      }

      if (!logOpts?.suppressLog) {
        console.log(
          `%c[${this.dbName.substring(0, 10)}]${
            logOpts?.transactionId
              ? `[tr_id=${logOpts.transactionId.split('-')[0]}]`
              : ''
          } ${sql} ${JSON.stringify(params)} Time: ${(
            (end - startTime) /
            1000
          ).toFixed(4)}`,
          `color: ${
            this.currentTransactionId
              ? colors[this.currentTransactionI % colors.length]
              : 'white'
          }`,
        );
      }

      return res;
    } catch (e) {
      console.error(
        `[${this.dbName}] Failed execute`,
        e,
        sql,
        params,
        logOpts,
        this.currentTransactionId,
      );
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
  private transactionStartedAt: number = 0;

  private inlineTransactionCounter = 0;

  response$: Subject<IResponse> = new Subject();

  private pastTransactionIds: string[] = [];

  constructor(private db: DbBackend) {
    setInterval(() => {
      if (!this.currentTransactionId) return;

      if (new Date().getTime() - this.transactionStartedAt > 8000) {
        console.error(
          `Transaction id = ${this.currentTransactionId} rollbacked due to timeout of 8s!`,
        );

        this.currentTransactionId = undefined;
        this.db.sqlExec('ROLLBACK;');
      }
    }, 5000);
  }

  exec(command: ICommand) {
    this.queue.push(command);

    const queue = this.queue;
    this.queue = [];

    // console.log(command, [...this.queue]);

    // console.log(
    //   `Queue to run: ${JSON.stringify(
    //     queue,
    //     null,
    //     2,
    //   )}\nCurrentCommand: ${JSON.stringify(command, null, 2)}`,
    // );

    // TODO: optimize it. We can await for commit, for example
    queue.forEach((com) => {
      this.runCommand(com);
    });
  }

  private flushQueue() {
    this.queue.forEach((com) => {
      this.runCommand(com);
    });
  }

  private runCommand(command: ICommand) {
    if (command.type === 'startTransaction') {
      this.startTransaction(command);
    } else if (
      command.type === 'commitTransaction' ||
      command.type === 'rollbackTransaction'
    ) {
      this.commitOrRollbackTransaction(command);
      this.flushQueue();
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

    this.response$.next(
      this.sqlExec(
        command.commandId,
        command.queries,
        Boolean(command.spawnTransaction),
        Boolean(command.suppressLog),
      ),
    );
  }

  private commitOrRollbackTransaction(
    command: IRollbackTransactionCommand | ICommitTransactionCommand,
  ) {
    // TODO: could be bug here — rollbacked transaction will return is comitted
    if (this.pastTransactionIds.includes(command.transactionId)) {
      this.response$.next({
        status: 'success',
        commandId: command.commandId,
        transactionId: command.transactionId,
        result: [],
      });
      return;
    }

    if (
      this.currentTransactionId &&
      this.currentTransactionId === command.transactionId
    ) {
      this.response$.next(
        this.sqlExec(
          command.commandId,
          [
            {
              text:
                command.type === 'commitTransaction' ? 'COMMIT' : 'ROLLBACK;',
              values: [],
            },
          ],
          false,
          Boolean(command.suppressLog),
        ),
      );

      this.pastTransactionIds.push(this.currentTransactionId);
      this.currentTransactionId = undefined;
    }
  }

  private startTransaction(command: IStartTransactionCommand) {
    if (this.pastTransactionIds.includes(command.transactionId)) return;
    if (this.currentTransactionId === command.transactionId) return;

    if (this.currentTransactionId) {
      this.queue.push(command);
    } else {
      this.currentTransactionId = command.transactionId;
      this.transactionStartedAt = new Date().getTime();

      this.response$.next(
        this.sqlExec(
          command.commandId,
          [{ text: 'BEGIN TRANSACTION;', values: [] }],
          false,
          Boolean(command.suppressLog),
        ),
      );
    }
  }

  private sqlExec(
    commandId: string,
    queries: Q.SqlBricksParam[],
    spawnTransaction: boolean,
    suppressLog: boolean,
  ): IResponse {
    const shouldSpawnTransaction =
      spawnTransaction && !this.currentTransactionId;

    try {
      if (shouldSpawnTransaction) {
        this.inlineTransactionCounter++;

        this.db.sqlExec('BEGIN TRANSACTION;', undefined, {
          transactionId: `inline${this.inlineTransactionCounter}`,
          suppressLog: suppressLog,
        });
      }

      const result = queries.map((q) => {
        return this.db.sqlExec(q.text, q.values, {
          transactionId: shouldSpawnTransaction
            ? `inline${this.inlineTransactionCounter}`
            : this.currentTransactionId,
          suppressLog: suppressLog,
        });
      });

      if (shouldSpawnTransaction) {
        this.db.sqlExec('COMMIT;', undefined, {
          transactionId: `inline${this.inlineTransactionCounter}`,
          suppressLog: suppressLog,
        });
      }

      // if (
      //   !shouldSpawnTransaction &&
      //   queries.find((q) => !q.text.includes('COMMIT')) &&
      //   Math.random() > 0.95
      // ) {
      //   console.error(
      //     'thowing hey!',
      //     commandId,
      //     queries,
      //     shouldSpawnTransaction,
      //   );
      //   throw new Error('hey!');
      // }

      return {
        commandId,
        status: 'success',
        result,
      };
    } catch (e) {
      console.log({ e });
      if (this.currentTransactionId || shouldSpawnTransaction) {
        this.db.sqlExec('ROLLBACK;', undefined, {
          transactionId: this.currentTransactionId
            ? this.currentTransactionId
            : `inline${this.inlineTransactionCounter}`,
          suppressLog: suppressLog,
        });

        if (this.currentTransactionId) {
          this.pastTransactionIds.push(this.currentTransactionId);
        }

        this.currentTransactionId = undefined;
      }

      return { commandId, status: 'error', message: (e as Error).message };
    }
  }
}

// eslint-disable-next-line no-restricted-globals
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
