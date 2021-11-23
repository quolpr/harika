import { Knex } from 'knex';

export const createChangesSchema = async (db: Knex, schemaName: string) => {
  console.log();

  await db.transaction(async (trx) => {
    await db.schema.transacting(trx).raw(`CREATE SCHEMA "${schemaName}";`);

    await db.schema
      .withSchema(schemaName)
      .transacting(trx)
      .raw(
        `CREATE TYPE ${schemaName}.changeType AS ENUM ('create', 'update', 'delete');`
      );

    await db.schema
      .transacting(trx)
      .createTable(`${schemaName}.syncDbChanges`, function (table) {
        table.uuid('id');
        table.string('dbName').notNullable();
        table.string('table').notNullable();
        table.string('key').notNullable();
        // table.specificType('type', `${schemaName}.changeType`).notNullable();
        table.bigInteger('rev').notNullable();
        table.uuid('receivedFromClientId').notNullable();

        table.jsonb('from');
        table.jsonb('to');

        table.jsonb('obj');

        table.index('receivedFromClientId', 'idxReceivedFromClientId');
        table.index([db.raw('rev ASC'), 'dbName'], 'idxRevDbName');

        table.timestamps();
      });

    await db.schema
      .transacting(trx)
      .raw(
        `alter table "${schemaName}"."syncDbChanges" add constraint "syncDbChanges_pkey" primary key ("id");`
      );

    await db.schema.transacting(trx).raw(`
      create function "${schemaName}"."assignRevId"() returns trigger as $$
        begin
          execute format('create sequence IF NOT EXISTS  "${schemaName}".rev_%s_seq', new.dbName);
          new.rev = nextval(format('"${schemaName}".rev_%s_seq', new.dbName));
          return new;
        end
      $$ language plpgsql;
     `);
    await db.schema.transacting(trx).raw(`
      create trigger "assignRevId" before insert on "${schemaName}"."syncDbChanges"
        for each row execute procedure "${schemaName}"."assignRevId"();
    `);
  });
};
