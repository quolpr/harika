import { Knex } from 'knex';
import { changesDbTable, entitiesDbTable } from './dbTypes';

export const createDbSchema = async (db: Knex, schemaName: string) => {
  await db.transaction(async (trx) => {
    await db.schema.transacting(trx).raw(`CREATE SCHEMA "${schemaName}";`);

    await db.schema
      .transacting(trx)
      .createTable(`${schemaName}.${changesDbTable}`, function (table) {
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
      .createTable(`${schemaName}.${entitiesDbTable}`, function (table) {
        table
          .string('docId')
          .notNullable()
          .unique()
          .primary({ constraintName: 'entities_primary_key' });
        table.string('collectionName').notNullable();
        table.jsonb('doc').notNullable();
        table.bigInteger('rev').notNullable().unique();

        table.index('collectionName', 'idxEntitiesReceivedTable');
        table.index('docId', 'idxEntitiesReceivedKey');
      });
  });
};
