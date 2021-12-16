import { Knex } from 'knex';
import { db as importedDb } from '../../../db/db';
import { usersDbsTable } from '../dbTypes';

export class DbService {
  constructor(private db: Knex = importedDb) {}

  async hasUserAccess(userId: string, dbName: string) {
    return (
      (await this.db.select().from(usersDbsTable).where({ userId, dbName }))
        .length > 0
    );
  }
}
