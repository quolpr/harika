import 'reflect-metadata';
// @ts-ignore
import DbWorker from './DbWorker?worker';
import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';
import Q from 'sql-bricks';
import {
  filter,
  first,
  lastValueFrom,
  map,
  Observable,
  Subject,
  takeUntil,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { inject, injectable } from 'inversify';
import { STOP_SIGNAL } from '../../framework/types';
import { v4 as uuidv4 } from 'uuid';
import { chunk } from 'lodash-es';
import {
  DB_NAME,
  ICommand,
  IInputWorkerMessage,
  IOutputWorkerMessage,
} from './types';
import { QueryExecResult } from '@harika-org/sql.js';

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
  execQuery(query: Q.Statement): Promise<QueryExecResult[]>;
  execQueries(queries: Q.Statement[]): Promise<QueryExecResult[][]>;
  insertRecords(
    table: string,
    objs: Record<string, any>[],
    replace?: boolean,
  ): Promise<void>;
  getRecords<T extends Record<string, any>>(query: Q.Statement): Promise<T[]>;
  transaction<T extends any>(func: (t: Transaction) => Promise<T>): Promise<T>;
  sqlExec(q: string): Promise<QueryExecResult[]>;
}

export class Transaction implements IQueryExecuter {
  constructor(private db: DB, public id: string) {}

  async sqlExec(q: string) {
    return this.db.sqlExec(q, this.id);
  }

  async execQuery(query: Q.Statement) {
    return this.db.execQuery(query, this.id);
  }

  async execQueries(queries: Q.Statement[]) {
    return this.db.execQueries(queries, this.id);
  }

  async commit() {
    return this.db.commitTransaction(this.id);
  }

  async getRecords<T extends Record<string, any>>(
    query: Q.Statement,
  ): Promise<T[]> {
    return this.db.getRecords(query, this.id);
  }

  async insertRecords(
    table: string,
    objs: Record<string, any>[],
    replace: boolean = false,
  ): Promise<void> {
    return this.db.insertRecords(table, objs, replace, this);
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
      const sub = (ev: MessageEvent<any>) => {
        obs.next(ev.data);
      };
      this.worker.addEventListener('message', sub);

      return () => {
        this.worker.removeEventListener('message', sub);
      };
    });

    this.messagesToWorker$.pipe(takeUntil(stop$)).subscribe((mes) => {
      this.worker.postMessage(mes);
    });
  }

  async sqlExec(q: string, transactionId?: string) {
    const res = await this.execCommand({
      type: 'execQueries',
      queries: [{ text: q, values: [] }],
      transactionId,
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

  async execQueries(queries: Q.Statement[], transactionId?: string) {
    return this.execCommand({
      type: 'execQueries',
      queries: queries.map((q) => q.toParams()),
      transactionId,
      inTransaction: queries.length > 1,
    });
  }

  async execQuery(query: Q.Statement, transactionId?: string) {
    const res = await this.execCommand({
      type: 'execQueries',
      queries: [query.toParams()],
      transactionId,
    });

    return res[0];
  }

  async transaction<T extends any>(
    func: (t: Transaction) => Promise<T>,
  ): Promise<T> {
    const trans = await this.startTransaction();

    try {
      return await func(trans);
    } finally {
      await trans.commit();
    }
  }

  private execCommand(command: DistributiveOmit<ICommand, 'commandId'>) {
    const id = uuidv4();

    // TODO: maybe timeout?
    const prom = lastValueFrom(
      this.messagesFromWorker$.pipe(
        filter((ev) => ev.type === 'response' && ev.data.commandId === id),
        first(),
        tap((ev) => {
          if (ev.type === 'response' && ev.data.status === 'error') {
            throw new Error(ev.data.message);
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
                  `Failed to execute ${JSON.stringify(command)} - timeout`,
                ),
            ),
        }),
      ),
    );

    this.messagesToWorker$.next({
      type: 'command',
      data: { ...command, commandId: id },
    });

    return prom;
  }

  async insertRecords(
    table: string,
    objs: Record<string, any>[],
    replace: boolean = false,
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

        await t.execQuery(query);
      }
    });
  }

  // TODO: add mapper to arg for better performance
  async getRecords<T extends Record<string, any>>(
    query: Q.Statement,
    transactionId?: string,
  ): Promise<T[]> {
    const [result] = await this.execQuery(query, transactionId);

    return (result?.values?.map((res) => {
      let obj: Record<string, any> = {};

      result.columns.forEach((col, i) => {
        obj[col] = res[i];
      });

      return obj;
    }) || []) as T[];
  }

  private async startTransaction(): Promise<Transaction> {
    const transactionId = uuidv4();

    await this.execCommand({
      type: 'startTransaction',
      transactionId,
    });

    return new Transaction(this, transactionId);
  }

  async commitTransaction(transactionId: string): Promise<void> {
    await this.execCommand({
      type: 'commitTransaction',
      transactionId,
    });
  }
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
