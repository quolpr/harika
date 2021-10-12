import 'reflect-metadata';
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
import { getIsLogSuppressing } from './suppressLog';
import { DB_NAME, IMigration } from './types';
import { inject, injectable } from 'inversify';

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

export const migrationsTable = 'migrations';

@injectable()
export class DB<Ctx extends object> {
  private sqlDb!: Database;
  private inTransaction: boolean = false;

  constructor(@inject(DB_NAME) private dbName: string) {
    console.log('new!', dbName);
  }

  async init(migrations: IMigration[]) {
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
      PRAGMA page_size=8192;
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

    this.sqlDb.run('BEGIN TRANSACTION;');

    const migratedMigrations = this.getRecords<{ id: number; name: string }>(
      Q.select('*').from(migrationsTable),
    );

    try {
      migrations
        .sort((a, b) => a.id - b.id)
        .forEach((migration) => {
          if (migratedMigrations.find(({ id }) => id === migration.id)) return;

          migration.up(this);

          this.execQuery(
            Q.insertInto(migrationsTable).values({
              id: migration.id,
              name: migration.name,
              migratedAt: new Date().getTime(),
            }),
          );
        });
    } catch (e) {
      this.sqlDb.run('ROLLBACK;');

      throw e;
    }

    this.sqlDb.run('COMMIT;');

    console.log('DB initialized!', this.dbName);
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
