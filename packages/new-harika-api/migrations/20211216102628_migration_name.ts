import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('usersDbs', function (table) {
    table.string('userId', 255).notNullable();
    table.string('dbName', 255).notNullable();

    table.unique(['userId', 'dbName']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('usersDbs');
}
