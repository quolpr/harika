import { Dexie } from 'dexie';
import { Subject } from 'rxjs';
import { buffer, concatMap, debounceTime } from 'rxjs/operators';
import { IDatabaseChange, DatabaseChangeType } from '../dexieTypes';
import { globalChangesSubject } from './changesChannel';
import { mapValues, pickBy } from 'lodash-es';
import { v4 } from 'uuid';

// export const startChangeLog = (db: Dexie, windowId: string) => {
//   db.use({
//     stack: 'dbcore', // The only stack supported so far.
//     name: 'SyncMiddleware', // Optional name of your middleware
//     level: 1,
//     create(downlevelDatabase) {
//       // Return your own implementation of DBCore:
//       return {
//         // Copy default implementation.
//         ...downlevelDatabase,
//         transaction: (req) => {
//           console.log('transaction!!!');

//           console.log({ req });

//           return downlevelDatabase.transaction(req);
//         },
//         // Override table method
//         // transaction: (tables, mode) => {
//         //   let tx: DBCoreTransaction & IDBTransaction & TXExpandos;
//         //   if (mode === 'readwrite') {
//         //     const mutationTables = tables
//         //       .filter((tbl) => db.cloud.schema?.[tbl]?.synced)
//         //       .map((tbl) => getMutationTable(tbl));
//         //     tx = core.transaction(
//         //       [...tables, ...mutationTables],
//         //       mode,
//         //     ) as DBCoreTransaction & IDBTransaction & TXExpandos;
//         //   } else {
//         //     tx = core.transaction(tables, mode) as DBCoreTransaction &
//         //       IDBTransaction &
//         //       TXExpandos;
//         //   }

//         //   if (mode === 'readwrite') {
//         //     // Give each transaction a globally unique id.
//         //     tx.txid = randomString(16);
//         //     // Introduce the concept of current user that lasts through the entire transaction.
//         //     // This is important because the tracked mutations must be connected to the user.
//         //     tx.currentUser = currentUserObservable.value;
//         //     outstandingTransactions.value.add(tx);
//         //     outstandingTransactions.next(outstandingTransactions.value);
//         //     const removeTransaction = () => {
//         //       tx.removeEventListener('complete', txComplete);
//         //       tx.removeEventListener('error', removeTransaction);
//         //       tx.removeEventListener('abort', removeTransaction);
//         //       outstandingTransactions.value.delete(tx);
//         //       outstandingTransactions.next(outstandingTransactions.value);
//         //     };
//         //     const txComplete = () => {
//         //       if (tx.mutationsAdded && db.cloud.options?.databaseUrl) {
//         //         if (db.cloud.options?.usingServiceWorker) {
//         //           console.debug('registering sync event');
//         //           registerSyncEvent(db);
//         //         } else {
//         //           db.localSyncEvent.next({});
//         //         }
//         //       }
//         //       removeTransaction();
//         //     };
//         //     tx.addEventListener('complete', txComplete);
//         //     tx.addEventListener('error', removeTransaction);
//         //     tx.addEventListener('abort', removeTransaction);
//         //   }
//         //   return tx;
//         // },
//         table(tableName) {
//           // Call default table method
//           const downlevelTable = downlevelDatabase.table(tableName);
//           // Derive your own table from it:
//           return {
//             // Copy default table implementation:
//             ...downlevelTable,
//             // Override the mutate method:
//             mutate: async (req) => {
//               const txSource = (Dexie.currentTransaction as any).source;
//               let oldObjects: Record<string, object> = {};

//               if (tableName[0] !== '_' && req.type === 'put') {
//                 (
//                   await db
//                     .table(tableName)
//                     .bulkGet(req.values.map(({ id }) => id))
//                 ).forEach((obj) => {
//                   if (obj) {
//                     oldObjects[obj.id] = obj;
//                   }
//                 });
//               }

//               const res = await downlevelTable.mutate(req);

//               if (tableName[0] !== '_') {
//                 const changes = ((): DistributiveOmit<
//                   IDatabaseChange,
//                   'source'
//                 >[] => {
//                   if (req.type === 'add') {
//                     return req.values.map((val) => {
//                       return {
//                         type: DatabaseChangeType.Create,
//                         table: tableName,
//                         key: val.id,
//                         obj: val,
//                       };
//                     });
//                   } else if (req.type === 'delete') {
//                     return req.keys.map((id) => {
//                       return {
//                         table: tableName,
//                         type: DatabaseChangeType.Delete,
//                         key: id,
//                       };
//                     });
//                   } else if (req.type === 'put') {
//                     return req.values.map((obj) => {
//                       if (oldObjects[obj.id]) {
//                         return {
//                           table: tableName,
//                           type: DatabaseChangeType.Update,
//                           obj,
//                           oldObj: oldObjects[obj.id] as Record<string, unknown>,
//                           // TODO: Maybe don't make objectDiff here for faster transaction?
//                           mods: (Dexie as any).getObjectDiff(
//                             oldObjects[obj.id],
//                             obj,
//                           ),
//                           key: obj.id,
//                         };
//                       } else {
//                         return {
//                           table: tableName,
//                           type: DatabaseChangeType.Create,
//                           obj: obj,
//                           key: obj.id,
//                         };
//                       }
//                     });
//                   } else {
//                     return [];
//                   }
//                 })();

//                 if (txSource !== 'serverChanges' && changes.length > 0) {
//                   await db.table('_changesToSend').bulkAdd(changes);
//                 }

//                 if (changes.length > 0) {
//                   globalChangesSubject.next(
//                     changes.map((ch) => ({
//                       ...ch,
//                       source: txSource,
//                       fromServer: txSource === 'serverChanges',
//                       windowId: windowId,
//                     })),
//                   );
//                 }
//               }

//               return res;
//             },
//           };
//         },
//       };
//     },
//   });
// };

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

              if (tableName[0] !== '_') {
                if (req.type === 'add') {
                  req.values.forEach((val) => {
                    changesSubject.next({
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
                      changesSubject.next({
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
                        changesSubject.next({
                          id: v4(),
                          table: tableName,
                          type: DatabaseChangeType.Update,
                          obj,
                          from: pickBy(oldObjects[obj.id], (_v, k) =>
                            modsKeys.includes(k),
                          ),
                          to: mods,
                          key: obj.id,
                          transactionSource: source,
                        });
                      }
                    } else {
                      changesSubject.next({
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
        const filteredChanges = changes.filter(
          ({ transactionSource }) => transactionSource !== 'serverChanges',
        );

        console.log({ newChanges: changes });

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
