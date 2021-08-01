import { DBCoreTransaction, Dexie } from 'dexie';
import { Subject } from 'rxjs';
import { buffer, concatMap, debounceTime } from 'rxjs/operators';
import { IDatabaseChange, DatabaseChangeType } from '../dexieTypes';
import { globalChangesSubject } from './changesChannel';
import { isEqual, mapValues, pickBy } from 'lodash-es';
import { v4 } from 'uuid';

export const startChangeLog = (db: Dexie, windowId: string) => {
  const changesSubject = new Subject<
    IDatabaseChange & { transactionSource: string }
  >();

  db.use({
    stack: 'dbcore', // The only stack supported so far.
    name: 'SyncMiddleware', // Optional name of your middleware
    create(downlevelDatabase) {
      // Return your own implementation of DBCore:
      return {
        // Copy default implementation.
        ...downlevelDatabase,
        transaction: (tables, mode) => {
          let tx: DBCoreTransaction & IDBTransaction;

          if (mode === 'readwrite') {
            tx = downlevelDatabase.transaction(
              [...tables, '_changesToSend'],
              mode,
            ) as DBCoreTransaction & IDBTransaction;
          } else {
            tx = downlevelDatabase.transaction(
              tables,
              mode,
            ) as DBCoreTransaction & IDBTransaction;
          }

          return tx;
        },
        // Override table method
        table(tableName) {
          // Call default table method
          const downlevelTable = downlevelDatabase.table(tableName);
          // Derive your own table from it:
          return {
            // Copy default table implementation:
            ...downlevelTable,
            // Override the mutate method:
            mutate: async (req) => {
              const source = (Dexie.currentTransaction as any).source;
              let oldObjects: Record<string, object> = {};

              if (tableName[0] !== '_' && req.type === 'put') {
                (
                  await db
                    .table(tableName)
                    .bulkGet(req.values.map(({ id }) => id))
                ).forEach((obj) => {
                  if (obj) {
                    oldObjects[obj.id] = obj;
                  }
                });
              }

              if (tableName[0] !== '_' && req.type === 'delete') {
                (await db.table(tableName).bulkGet(req.keys)).forEach((obj) => {
                  if (obj) {
                    oldObjects[obj.id] = obj;
                  }
                });
              }

              const res = await downlevelTable.mutate(req);

              let mutations: (IDatabaseChange & {
                transactionSource: string;
              })[] = [];

              if (tableName[0] !== '_') {
                if (req.type === 'add') {
                  req.values.forEach((val) => {
                    mutations.push({
                      id: v4(),
                      type: DatabaseChangeType.Create,
                      table: tableName,
                      key: val.id,
                      obj: val,
                      transactionSource: source,
                    });
                  });
                }

                if (req.type === 'delete') {
                  req.keys.forEach((id) => {
                    if (oldObjects[id]) {
                      mutations.push({
                        id: v4(),
                        table: tableName,
                        type: DatabaseChangeType.Delete,
                        key: id,
                        transactionSource: source,
                        obj: oldObjects[id] as Record<string, unknown>,
                      });
                    }
                  });
                }

                if (req.type === 'put') {
                  req.values.forEach((obj) => {
                    if (oldObjects[obj.id]) {
                      const mods = mapValues(
                        (Dexie as any).getObjectDiff(oldObjects[obj.id], obj),
                        (val) => (val === undefined ? null : val),
                      );

                      const modsKeys = Object.keys(mods);

                      if (Object.values(mods).length !== 0) {
                        const from = pickBy(oldObjects[obj.id], (_v, k) =>
                          modsKeys.includes(k),
                        );

                        if (isEqual(from, mods)) return;

                        mutations.push({
                          id: v4(),
                          table: tableName,
                          type: DatabaseChangeType.Update,
                          obj,
                          from,
                          to: mods,
                          key: obj.id,
                          transactionSource: source,
                        });
                      }
                    } else {
                      mutations.push({
                        id: v4(),
                        table: tableName,
                        type: DatabaseChangeType.Create,
                        obj: obj,
                        key: obj.id,
                        transactionSource: source,
                      });
                    }
                  });
                }
              }

              if (mutations.length !== 0 && source !== 'serverChanges') {
                await db.table('_changesToSend').bulkAdd(mutations);
              }

              if (mutations.length !== 0) {
                mutations.forEach((mut) => changesSubject.next(mut));
              }

              return res;
            },
          };
        },
      };
    },
  });

  changesSubject
    .pipe(
      buffer(changesSubject.pipe(debounceTime(100))),
      concatMap(async (changes) => {
        globalChangesSubject.next(
          changes.map((ch) => ({
            ...ch,
            source: ch.transactionSource,
            fromServer: ch.transactionSource === 'serverChanges',

            windowId: windowId,
          })),
        );
      }),
    )
    .subscribe();
};
