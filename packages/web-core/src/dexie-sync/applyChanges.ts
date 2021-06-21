import { Dexie, Table } from 'dexie';
import {
  DatabaseChangeType,
  IDeleteChange,
  ICreateChange,
  IUpdateChange,
} from '@harika/common';
import { maxBy } from 'lodash-es';
import type { IServerChangesRow, ISyncStatus } from './ServerSynchronizer';

async function bulkUpdate(table: Table, changes: IUpdateChange[]) {
  let keys = changes.map((c) => c.key);
  let map: Record<string, any> = {};
  // Retrieve current object of each change to update and map each
  // found object's primary key to the existing object:
  await table
    .where(':id')
    .anyOf(keys)
    .raw()
    .each((obj, cursor) => {
      map[cursor.primaryKey + ''] = obj;
    });
  // Filter away changes whose key wasn't found in the local database
  // (we can't update them if we do not know the existing values)
  let updatesThatApply = changes.filter((c_1) =>
    map.hasOwnProperty(c_1.key + ''),
  );
  // Apply modifications onto each existing object (in memory)
  // and generate array of resulting objects to put using bulkPut():
  let objsToPut = updatesThatApply.map((c_2) => {
    let curr = map[c_2.key + ''];
    Object.keys(c_2.mods).forEach((keyPath) => {
      Dexie.setByKeyPath(curr, keyPath, c_2.mods[keyPath]);
    });
    return curr;
  });
  return await table.bulkPut(objsToPut);
}

export function applyChanges(db: Dexie, changeRows: IServerChangesRow[]) {
  let collectedChanges: Record<
    string,
    {
      [DatabaseChangeType.Create]: ICreateChange[];
      [DatabaseChangeType.Delete]: IDeleteChange[];
      [DatabaseChangeType.Update]: IUpdateChange[];
    }
  > = {};

  changeRows.forEach((row) => {
    if (!collectedChanges.hasOwnProperty(row.change.table)) {
      collectedChanges[row.change.table] = {
        [DatabaseChangeType.Create]: [],
        [DatabaseChangeType.Delete]: [],
        [DatabaseChangeType.Update]: [],
      };
    }
    collectedChanges[row.change.table][row.change.type].push(row.change as any);
  });

  let tableNames = Object.keys(collectedChanges);
  let tables = tableNames.map((table) => db.table(table));

  const maxRevision = maxBy(
    changeRows,
    ({ receivedAtRevisionOfServer }) => receivedAtRevisionOfServer,
  )?.receivedAtRevisionOfServer;

  console.log({ maxRevision });

  if (maxRevision === undefined)
    throw new Error('Max revision could not be undefined');

  return db.transaction(
    'rw',
    [...tables, db.table('_syncStatus'), db.table('_changesFromServer')],
    async () => {
      await Promise.all(
        tableNames.map(async (table_name) => {
          // @ts-ignore
          Dexie.currentTransaction.source = 'serverChanges';

          const table = db.table(table_name);
          const specifyKeys = !table.schema.primKey.keyPath;
          const createChangesToApply =
            collectedChanges[table_name][DatabaseChangeType.Create];
          const deleteChangesToApply =
            collectedChanges[table_name][DatabaseChangeType.Delete];
          const updateChangesToApply =
            collectedChanges[table_name][DatabaseChangeType.Update];

          if (createChangesToApply.length > 0)
            await table.bulkPut(
              createChangesToApply.map((c) => c.obj),
              specifyKeys ? createChangesToApply.map((c) => c.key) : undefined,
            );
          if (updateChangesToApply.length > 0)
            await bulkUpdate(table, updateChangesToApply);
          if (deleteChangesToApply.length > 0)
            await table.bulkDelete(deleteChangesToApply.map((c) => c.key));
        }),
      );

      await db
        .table('_changesFromServer')
        .bulkDelete(changeRows.map(({ id }) => id));

      await db.table<ISyncStatus>('_syncStatus').update(1, {
        lastAppliedRemoteRevision: maxRevision,
      });
    },
  );
}
