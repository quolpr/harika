import { inject, injectable, multiInject } from 'inversify';
import Q from 'sql-bricks';

import { DB } from './DB';
import { DB_MIGRATIONS, IMigration, migrationsTable } from './types';

@injectable()
export class MigrationRunner {
  constructor(
    @multiInject(DB_MIGRATIONS) private migrations: IMigration[],
    @inject(DB) private db: DB,
  ) {}

  async run() {
    const migratedMigrations = await this.db.getRecords<{
      id: number;
      name: string;
    }>(Q.select('*').from(migrationsTable));

    await this.db.transaction(async (t) => {
      for (const migration of this.migrations.sort((a, b) => a.id - b.id)) {
        if (migratedMigrations.find(({ id }) => id === migration.id)) continue;

        await migration.up(t);

        await t.execQuery(
          Q.insertInto(migrationsTable).values({
            id: migration.id,
            name: migration.name,
            migratedAt: new Date().getTime(),
          }),
        );
      }
    });
  }
}
