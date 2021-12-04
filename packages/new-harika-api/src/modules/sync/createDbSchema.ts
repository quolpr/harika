import { Knex } from 'knex';

export const createDbSchema = async (db: Knex, schemaName: string) => {
  await db.transaction(async (trx) => {
    await db.schema.transacting(trx).raw(`CREATE SCHEMA "${schemaName}";`);

    await db.schema
      .transacting(trx)
      .createTable(`${schemaName}.changes`, function (table) {
        table.uuid('id');
        table.string('table').notNullable();
        table.string('key').notNullable();
        table.string('scopeId');
        table.increments('rev', { primaryKey: false }).notNullable();

        table.uuid('receivedFromClientId').notNullable();
        table.string('timestamp');
        table.string('type', 10).notNullable();

        table.jsonb('from');
        table.jsonb('to');

        table.jsonb('obj');

        table.index('receivedFromClientId', 'idxChangesReceivedFromClientId');
        table.index('scopeId', 'idxChangesScopeId');
        table.index([db.raw('rev ASC')], 'idxChangesRevDbName');

        table.timestamps();
      });

    await db.schema
      .transacting(trx)
      .raw(
        `alter table "${schemaName}"."changes" add constraint "changes_pkey" primary key ("id");`
      );

    await db.schema
      .transacting(trx)
      .createTable(`${schemaName}.entities`, function (table) {
        table.uuid('id');
        table.string('table').notNullable();
        table.string('key').notNullable();
        table.string('obj').notNullable();
        table.string('rev').notNullable();

        table.index('table', 'idxEntitiesReceivedTable');
        table.index('key', 'idxEntitiesReceivedKey');
      });
  });
};
