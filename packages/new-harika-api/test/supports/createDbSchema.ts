import { createDbSchema } from '../../src/modules/sync/createDbSchema';
import { v4 } from 'uuid';
import { db } from '../../src/db/db';

export const createTestDbSchema = async () => {
  const dbName = `test_db_${v4().replace(/-/g, '').slice(-16)}`;

  await dropTestDbSchema(dbName);

  await createDbSchema(db, dbName);

  return dbName;
};

export const dropTestDbSchema = async (dbName: string) => {
  await db.raw(`DROP SCHEMA IF EXISTS ${dbName} CASCADE`);
};
