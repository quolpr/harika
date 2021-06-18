import { Dexie } from 'dexie';
import { Subject } from 'rxjs';
import { buffer, concatMap, debounceTime } from 'rxjs/operators';
import { IDatabaseChange, DatabaseChangeType } from '@harika/common';
import { omit } from 'lodash-es';

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

type IChangeRow = DistributiveOmit<IDatabaseChange, 'source'>;

export const startChangeLog = (db: Dexie) => {
  const changesSubject = new Subject<IChangeRow>();

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
              let oldObjects: Record<string, object> = {};
              const source = (Dexie.currentTransaction as any).source;

              if (source !== 'serverChanges') {
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
              }

              const res = await downlevelTable.mutate(req);

              if (source !== 'serverChanges') {
                if (tableName[0] !== '_') {
                  if (req.type === 'add') {
                    req.values.forEach((val) => {
                      changesSubject.next({
                        type: DatabaseChangeType.Create,
                        table: tableName,
                        key: val.id,
                        obj: val,
                      });
                    });
                  }

                  if (req.type === 'delete') {
                    req.keys.forEach((id) => {
                      changesSubject.next({
                        table: tableName,
                        type: DatabaseChangeType.Delete,
                        key: id,
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
                        });
                      } else {
                        changesSubject.next({
                          table: tableName,
                          type: DatabaseChangeType.Create,
                          obj: obj,
                          key: obj.id,
                        });
                      }
                    });
                  }
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
        > => {
          if (change.type === DatabaseChangeType.Update) {
            return omit(
              {
                ...change,
                mods: (Dexie as any).getObjectDiff(change.oldObj, change.obj),
              },
              ['oldObj', 'obj'],
            );
          }

          return change;
        });

        await db.table('_changesToSend').bulkAdd(changes);
      }),
    )
    .subscribe();
};
