import { createDbSchema } from '../../src/modules/sync/createDbSchema';
import { pg } from '../../src/plugins/db';

let i = 0;

export const createTestDbSchema = async () => {
  const dbName = `test_db_${i++}`;

  await dropTestDbSchema(dbName);

  await createDbSchema(pg, dbName);

  return dbName;
};

export const dropTestDbSchema = async (dbName: string) => {
  await pg.raw(`DROP SCHEMA IF EXISTS ${dbName} CASCADE`);
};
