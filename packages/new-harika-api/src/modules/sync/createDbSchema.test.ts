import { pg } from '../../plugins/db';
import { createDbSchema } from './createDbSchema';

const dbName = 'test5';

describe('createDbSchema', () => {
  beforeEach(async () => {
    await pg.raw(`DROP SCHEMA IF EXISTS ${dbName} CASCADE`);
  });

  afterEach(async () => {
    await pg.raw(`DROP SCHEMA IF EXISTS ${dbName} CASCADE`);
  });

  it('just works', async () => {
    await createDbSchema(pg, dbName);
  });
});
