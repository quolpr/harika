import { createDbSchema } from '../../src/modules/sync/createDbSchema';
import { pg } from '../../src/plugins/db';
import { v4 } from 'uuid';

export const createTestDbSchema = async () => {
  const dbName = `test_db_${v4().replace(/-/g, '').slice(-16)}`;

  await dropTestDbSchema(dbName);

  await createDbSchema(pg, dbName);

  return dbName;
};

export const dropTestDbSchema = async (dbName: string) => {
  await pg.raw(`DROP SCHEMA IF EXISTS ${dbName} CASCADE`);
};
