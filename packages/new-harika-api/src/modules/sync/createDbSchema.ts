import { Knex } from 'knex';
import { docChangesTable, snapshotsTable, usersDbsTable } from './dbTypes';
import { DbService } from './services/DbService';

export const createDbSchema = async (db: Knex, dbName: string) => {
  await db.transaction(async (trx) => {
    await db.schema.transacting(trx).createSchemaIfNotExists(dbName);

    await db.schema
      .transacting(trx)
      .createTable(`${dbName}.${docChangesTable}`, function (table) {
        table.uuid('id').primary({ constraintName: 'changes_primary_key' });
        table.string('collectionName').notNullable();
        table.string('docId').notNullable();
        table.string('scopeId');
        table
          .bigIncrements('rev', { primaryKey: false })
          .notNullable()
          .unique();

        table.string('receivedFromClientId', 16).notNullable();
        table.string('timestamp').unique();
        table.string('type', 10).notNullable();

        table.jsonb('from');
        table.jsonb('to');

        table.jsonb('doc');

        table.index('receivedFromClientId', 'idxChangesReceivedFromClientId');
        table.index('scopeId', 'idxChangesScopeId');
        table.index([db.raw('rev ASC')], 'idxChangesRevDbName');
      });

    await db.schema
      .transacting(trx)
      .createTable(`${dbName}.${snapshotsTable}`, function (table) {
        // TODO: docId + collectionName PK
        table.string('docId').notNullable();
        table.string('collectionName').notNullable();
        table.jsonb('doc').notNullable();
        table.bigInteger('rev').notNullable().unique();
        table.boolean('isDeleted').notNullable();
        table.string('lastTimestamp').notNullable();
        table.string('scopeId');

        table.index('collectionName', 'idxEntitiesReceivedTable');
        table.index('docId', 'idxEntitiesReceivedKey');

        table.primary(['collectionName', 'docId'], {
          constraintName: 'snapshots_primary_key',
        });
      });
  });
};

export const createIfNotExistsDbSchema = async (
  db: Knex,
  userId: string,
  dbName: string
) => {
  return db.transaction(async (t) => {
    const dbService = new DbService(t);

    const isDbExists =
      (
        await t
          .select()
          .from('information_schema.schemata')
          .where({ schema_name: dbName })
      ).length > 0;
    const hasUserAccess = await dbService.hasUserAccess(userId, dbName);

    if (!isDbExists) {
      await createDbSchema(t, dbName);
      await t.insert({ userId, dbName }).into(usersDbsTable);

      return;
    }

    if (!hasUserAccess) {
      throw new Error('No access!');
    }
  });
};
