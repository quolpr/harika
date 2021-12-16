import { db } from '../../db/db';
import { createDbSchema, createIfNotExistsDbSchema } from './createDbSchema';
import { v4 } from 'uuid';
import { DbService } from './services/DbService';

const userId = v4();
const dbName = 'test5';

const dbService = new DbService();

describe('createDbSchema', () => {
  beforeEach(async () => {
    await db.raw(`DROP SCHEMA IF EXISTS ${dbName} CASCADE`);
  });

  afterEach(async () => {
    await db.raw(`DROP SCHEMA IF EXISTS ${dbName} CASCADE`);
  });

  it('just works', async () => {
    await createDbSchema(db, dbName);
  });
});

describe('createIfNotExistsDbSchema', () => {
  beforeEach(async () => {
    await db.raw(`DROP SCHEMA IF EXISTS ${dbName} CASCADE`);
  });

  afterEach(async () => {
    await db.raw(`DROP SCHEMA IF EXISTS ${dbName} CASCADE`);
  });

  it('works', async () => {
    expect(await dbService.hasUserAccess(userId, dbName)).toBe(false);
    await createIfNotExistsDbSchema(db, userId, dbName);
    expect(await dbService.hasUserAccess(userId, dbName)).toBe(true);

    expect(async () => {
      await createIfNotExistsDbSchema(db, userId, dbName);
    }).not.toThrow();

    expect(async () => {
      await createIfNotExistsDbSchema(db, userId + '123', dbName);
    }).rejects.toThrow('No access!');
  });
});
