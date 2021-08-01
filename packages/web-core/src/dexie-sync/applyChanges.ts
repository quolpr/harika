import { Dexie, Table } from 'dexie';
import {
  DatabaseChangeType,
  IDeleteChange,
  ICreateChange,
  IUpdateChange,
  IDatabaseChange,
} from '../dexieTypes';

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

    // TODO: also mark keys from `from` that not present in `to` as undefined
    Object.keys(c_2.to).forEach((keyPath) => {
      Dexie.setByKeyPath(curr, keyPath, c_2.to[keyPath]);
    });
    return curr;
  });
  return await table.bulkPut(objsToPut);
}

export function applyChanges(db: Dexie, changes: IDatabaseChange[]) {
  let collectedChanges: Record<
    string,
    {
      [DatabaseChangeType.Create]: ICreateChange[];
      [DatabaseChangeType.Delete]: IDeleteChange[];
      [DatabaseChangeType.Update]: IUpdateChange[];
    }
  > = {};

  changes.forEach((change) => {
    if (!collectedChanges.hasOwnProperty(change.table)) {
      collectedChanges[change.table] = {
        [DatabaseChangeType.Create]: [],
        [DatabaseChangeType.Delete]: [],
        [DatabaseChangeType.Update]: [],
      };
    }
    collectedChanges[change.table][change.type].push(change as any);
  });

  let tableNames = Object.keys(collectedChanges);

  // const maxRevision = maxBy(
  //   changeRows,
  //   ({ receivedAtRevisionOfServer }) => receivedAtRevisionOfServer,
  // )?.receivedAtRevisionOfServer;

  // console.log({ maxRevision });

  // if (maxRevision === undefined)
  //   throw new Error('Max revision could not be undefined');
  return Promise.all(
    tableNames.map(async (table_name) => {
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

  // await db
  //   .table('_changesFromServer')
  //   .bulkDelete(changeRows.map(({ id }) => id));

  // await db.table<ISyncStatus>('_syncStatus').update(1, {
  //   lastAppliedRemoteRevision: maxRevision,
  // });
}
