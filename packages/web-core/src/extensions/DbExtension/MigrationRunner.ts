import { DB } from './DB';
import { IMigration } from './types';
import Q from 'sql-bricks';

export const migrationsTable = 'migrations';

export class MigrationRunner {
  constructor(private migrations: IMigration[], private db: DB) {}

  async run() {
    const migratedMigrations = await this.db.getRecords<{
      id: number;
      name: string;
    }>(Q.select('*').from(migrationsTable));

    const trans = await this.db.startTransaction();

    for (const migration of this.migrations.sort((a, b) => a.id - b.id)) {
      if (migratedMigrations.find(({ id }) => id === migration.id)) return;

      await migration.up(trans);

      await trans.execQuery(
        Q.insertInto(migrationsTable).values({
          id: migration.id,
          name: migration.name,
          migratedAt: new Date().getTime(),
        }),
      );
    }

    await trans.commit();
  }
}
