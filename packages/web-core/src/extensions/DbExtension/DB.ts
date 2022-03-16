import 'reflect-metadata';

import { QueryExecResult } from '@harika-org/sql.js';
import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import { inject, injectable } from 'inversify';
import { chunk } from 'lodash-es';
import {
  filter,
  first,
  lastValueFrom,
  map,
  Observable,
  of,
  ReplaySubject,
  share,
  Subject,
  switchMap,
  takeUntil,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import Q from 'sql-bricks';
import { v4 as uuidv4 } from 'uuid';

import { STOP_SIGNAL } from '../../framework/types';
import { Sql } from '../../lib/sql';
// @ts-ignore
import DbWorker from './DbWorker?worker';
import {
  DB_NAME,
  ICommand,
  IInputWorkerMessage,
  IOutputWorkerMessage,
} from './types';

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

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

export interface IQueryExecuter {
  execQuery(
    query: Q.Statement | Sql,
    suppressLog?: boolean,
  ): Promise<QueryExecResult[]>;
  execQueries(
    queries: (Q.Statement | Sql)[],
    suppressLog?: boolean,
  ): Promise<QueryExecResult[][]>;
  insertRecords(
    table: string,
    objs: Record<string, any>[],
    replace?: boolean,
    suppressLog?: boolean,
  ): Promise<void>;
  getRecords<T extends Record<string, any>>(
    query: Q.Statement | Sql,
    suppressLog?: boolean,
  ): Promise<T[]>;
  transaction<T extends any>(
    func: (t: Transaction) => Promise<T>,
    suppressLog?: boolean,
  ): Promise<T>;
  sqlExec(q: string, suppressLog?: boolean): Promise<QueryExecResult[]>;
}

export class Transaction implements IQueryExecuter {
  constructor(
    private db: DB,
    public id: string,
    private commitTransaction: () => Promise<void>,
    private rollbackTransaction: () => Promise<void>,
    private suppressLog: boolean,
  ) {}

  async sqlExec(q: string, suppressLog?: boolean) {
    return this.db.sqlExec(
      q,
      suppressLog !== undefined ? suppressLog : this.suppressLog,
      this.id,
    );
  }

  async execQuery(query: Q.Statement, suppressLog?: boolean) {
    return this.db.execQuery(
      query,
      suppressLog !== undefined ? suppressLog : this.suppressLog,
      this.id,
    );
  }

  async execQueries(queries: Q.Statement[], suppressLog?: boolean) {
    return this.db.execQueries(
      queries,
      suppressLog !== undefined ? suppressLog : this.suppressLog,
      this.id,
    );
  }

  async commit() {
    return this.commitTransaction();
  }

  async rollback() {
    return this.rollbackTransaction();
  }

  async getRecords<T extends Record<string, any>>(
    query: Q.Statement | Sql,
    suppressLog?: boolean,
  ): Promise<T[]> {
    return this.db.getRecords(
      query,
      suppressLog !== undefined ? suppressLog : this.suppressLog,
      this.id,
    );
  }

  async insertRecords(
    table: string,
    objs: Record<string, any>[],
    replace: boolean = false,
    suppressLog: boolean = false,
  ): Promise<void> {
    return this.db.insertRecords(
      table,
      objs,
      replace,
      suppressLog !== undefined ? suppressLog : this.suppressLog,
      this,
    );
  }

  transaction<T extends any>(func: (t: Transaction) => Promise<T>): Promise<T> {
    // We already in transaction
    return func(this);
  }
}
@injectable()
export class DB implements IQueryExecuter {
  private worker: Worker;
  private messagesFromWorker$: Observable<IOutputWorkerMessage>;
  private messagesToWorker$: Subject<IInputWorkerMessage> = new Subject();

  constructor(
    @inject(STOP_SIGNAL) private stop$: Observable<void>,
    @inject(DB_NAME) private dbName: string,
  ) {
    this.worker = new DbWorker();

    initBackend(this.worker);

    this.messagesFromWorker$ = new Observable<IOutputWorkerMessage>((obs) => {
      const sub = (ev: MessageEvent<IOutputWorkerMessage>) => {
        // console.log(
        //   `[DB][${
        //     ev.data.type === 'response' && ev.data.data.commandId
        //   }] new message from worker`,
        //   ev.data,
        // );
        obs.next(ev.data);
      };
      this.worker.addEventListener('message', sub);

      return () => {
        this.worker.removeEventListener('message', sub);
      };
    }).pipe(
      share({
        connector: () => new ReplaySubject(20),
        resetOnRefCountZero: false,
      }),
      takeUntil(stop$),
    );

    this.messagesToWorker$.pipe(takeUntil(stop$)).subscribe((mes) => {
      // console.log(
      //   `[DB][${
      //     mes.type === 'command' && mes.data.commandId
      //   }] new message to worker`,
      //   mes,
      // );
      this.worker.postMessage(mes);
    });
  }

  async sqlExec(q: string, suppressLog?: boolean, transactionId?: string) {
    const res = await this.execCommand({
      type: 'execQueries',
      queries: [{ text: q, values: [] }],
      transactionId,
      suppressLog,
    });

    return res[0];
  }

  async init() {
    // maybe timeout?
    const prom = lastValueFrom(
      this.messagesFromWorker$.pipe(
        filter((ev) => ev.type === 'initialized'),
        first(),
      ),
    );

    this.messagesToWorker$.next({ type: 'initialize', dbName: this.dbName });

    return prom;
  }

  async execQueries(
    queries: (Q.Statement | Sql)[],
    suppressLog?: boolean,
    transactionId?: string,
  ) {
    return this.execCommand({
      type: 'execQueries',
      queries: queries.map((q) =>
        'toParams' in q ? q.toParams() : { values: q.values, text: q.text },
      ),
      transactionId,
      spawnTransaction: queries.length > 1,
      suppressLog,
    });
  }

  async execQuery(
    query: Q.Statement | Sql,
    suppressLog?: boolean,
    transactionId?: string,
  ) {
    const res = await this.execCommand({
      type: 'execQueries',
      queries: [
        'toParams' in query
          ? query.toParams()
          : { values: query.values, text: query.text },
      ],
      transactionId,
      suppressLog,
    });

    return res[0];
  }

  async transaction<T extends any>(
    func: (t: Transaction) => Promise<T>,
    suppressLog?: boolean,
  ): Promise<T> {
    const trans = await this.startTransaction(Boolean(suppressLog));

    try {
      const res = await func(trans);

      await trans.commit();

      return res;
    } catch (e) {
      await trans.rollback();

      throw e;
    }
  }

  private execCommand(command: DistributiveOmit<ICommand, 'commandId'>) {
    const id = uuidv4();

    const waitResponse = () =>
      this.messagesFromWorker$.pipe(
        filter((ev) => ev.type === 'response' && ev.data.commandId === id),
        first(),
        switchMap((ev) => {
          if (ev.type === 'response' && ev.data.status === 'error') {
            throw new Error(ev.data.message);
          } else {
            return of(ev);
          }
        }),
        map((ev) => {
          if (ev.type === 'response' && ev.data.status === 'success') {
            return ev.data.result;
          } else {
            throw new Error('Unknown data format');
          }
        }),
        timeout({
          each: 8000,
          with: () =>
            throwError(
              () =>
                new Error(
                  `Failed to execute ${JSON.stringify(
                    command,
                  )} with id ${id} - timeout`,
                ),
            ),
        }),
      );

    // TODO: race condition may happen here.
    // When response received but we didn't start listening it
    // Not sure how to fix it with RxJS
    const prom = lastValueFrom(
      of(null).pipe(
        tap(() => {
          this.messagesToWorker$.next({
            type: 'command',
            data: { ...command, commandId: id },
          });
        }),
        switchMap(() => waitResponse()),
      ),
    );

    return prom;
  }

  async insertRecords(
    table: string,
    objs: Record<string, any>[],
    replace: boolean = false,
    suppressLog: boolean = false,
    e: IQueryExecuter = this,
  ) {
    return e.transaction(async (t) => {
      // sqlite max vars = 32766
      // Let's take table columns count to 20, so 20 * 1000 will fit the restriction
      for (const chunkObjs of chunk(objs, 1000)) {
        let query = Q.insertInto(table).values(chunkObjs);

        if (replace) {
          query = query.orReplace();
        }

        await t.execQuery(query, suppressLog);
      }
    });
  }

  // TODO: add mapper to arg for better performance
  async getRecords<T extends Record<string, any>>(
    query: Q.Statement | Sql,
    suppressLog?: boolean,
    transactionId?: string,
  ): Promise<T[]> {
    const [result] = await this.execQuery(query, suppressLog, transactionId);

    return (result?.values?.map((res) => {
      let obj: Record<string, any> = {};

      result.columns.forEach((col, i) => {
        obj[col] = res[i];
      });

      return obj;
    }) || []) as T[];
  }

  private async startTransaction(suppressLog: boolean): Promise<Transaction> {
    const transactionId = uuidv4();

    await this.execCommand({
      type: 'startTransaction',
      transactionId,
      suppressLog,
    });

    return new Transaction(
      this,
      transactionId,
      () => this.commitTransaction(transactionId, suppressLog),
      () => this.rollbackTransaction(transactionId, suppressLog),
      suppressLog,
    );
  }

  private commitTransaction = async (
    transactionId: string,
    suppressLog: boolean,
  ) => {
    await this.execCommand({
      type: 'commitTransaction',
      transactionId,
      suppressLog,
    });
  };

  private rollbackTransaction = async (
    transactionId: string,
    suppressLog: boolean,
  ) => {
    await this.execCommand({
      type: 'rollbackTransaction',
      transactionId,
      suppressLog,
    });
  };
}

// const run = async () => {
//   const dbFront = new DB(new Subject());

//   await dbFront.init();

//   console.log('initialized!!!!!!!!!!!!!');

//   const transaction = await dbFront.startTransaction();

//   console.log(
//     'result!!!!!!!!!!!!!',
//     await transaction.execQueries([
//       Q.select('*').from(migrationsTable),
//       Q.select('*').from(migrationsTable),
//     ]),
//   );

//   await transaction.commit();
// };

// run();
