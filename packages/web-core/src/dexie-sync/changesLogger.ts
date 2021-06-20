import { Dexie } from 'dexie';
import { Subject } from 'rxjs';
import { buffer, concatMap, debounceTime } from 'rxjs/operators';
import { IDatabaseChange, DatabaseChangeType } from '@harika/common';
import { globalChangesSubject } from './changesChannel';

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export type IChangeRow = DistributiveOmit<IDatabaseChange, 'source'>;

export const startChangeLog = (db: Dexie, windowId: string) => {
  const changesSubject = new Subject<
    IChangeRow & { transactionSource: string }
  >();

  db.use({
    stack: 'dbcore', // The only stack supported so far.
    name: 'SyncMiddleware', // Optional name of your middleware
    create(downlevelDatabase) {
      // Return your own implementation of DBCore:
      return {
        // Copy default implementation.
        ...downlevelDatabase,
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

              const res = await downlevelTable.mutate(req);

              if (tableName[0] !== '_') {
                if (req.type === 'add') {
                  req.values.forEach((val) => {
                    changesSubject.next({
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
                    changesSubject.next({
                      table: tableName,
                      type: DatabaseChangeType.Delete,
                      key: id,
                      transactionSource: source,
                    });
                  });
                }

                if (req.type === 'put') {
                  req.values.forEach((obj) => {
                    if (oldObjects[obj.id]) {
                      changesSubject.next({
                        table: tableName,
                        type: DatabaseChangeType.Update,
                        obj,
                        oldObj: oldObjects[obj.id] as Record<string, unknown>,
                        mods: {},
                        key: obj.id,
                        transactionSource: source,
                      });
                    } else {
                      changesSubject.next({
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
      concatMap(async (rawChanges) => {
        let changes = rawChanges.map((change): DistributiveOmit<
          IDatabaseChange,
          'source'
        > & { transactionSource: string } => {
          if (change.type === DatabaseChangeType.Update) {
            return {
              ...change,
              mods: (Dexie as any).getObjectDiff(change.oldObj, change.obj),
            };
          }

          return change;
        });

        const filteredChanges = changes.filter(
          ({ transactionSource }) => transactionSource !== 'serverChanges',
        );

        if (filteredChanges.length > 0) {
          await db.table('_changesToSend').bulkAdd(filteredChanges);
        }

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
