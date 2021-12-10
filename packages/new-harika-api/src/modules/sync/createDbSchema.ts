import { Knex } from 'knex';
import { docChangesTable, snapshotsTable } from './dbTypes';

export const createDbSchema = async (db: Knex, schemaName: string) => {
  await db.transaction(async (trx) => {
    await db.schema.transacting(trx).raw(`CREATE SCHEMA "${schemaName}";`);

    await db.schema
      .transacting(trx)
      .createTable(`${schemaName}.${docChangesTable}`, function (table) {
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
      .createTable(`${schemaName}.${snapshotsTable}`, function (table) {
        // TODO: docId + collectionName PK
        table
          .string('docId')
          .notNullable()
          .unique()
          .primary({ constraintName: 'entities_primary_key' });
        table.string('collectionName').notNullable();
        table.jsonb('doc').notNullable();
        table.bigInteger('rev').notNullable().unique();
        table.boolean('isDeleted').notNullable();
        table.string('lastTimestamp').notNullable();
        table.string('scopeId');

        table.index('collectionName', 'idxEntitiesReceivedTable');
        table.index('docId', 'idxEntitiesReceivedKey');
      });
  });
};

export const createIfNotExistsDbSchema = async (
  db: Knex,
  schemaName: string
) => {
  const res = await db
    .select()
    .from('information_schema.schemata')
    .where({ schema_name: schemaName });

  if (res.length === 0) {
    await createDbSchema(db, schemaName);
  }
};
