import {
  createTestDbSchema,
  dropTestDbSchema,
} from '../../../../test/supports/createDbSchema';
import { db } from '../../../db/db';
import { DocSnapshotsService } from './DocSnapshotsService';

describe('DocSnapshotsService', () => {
  let schemaName!: string;
  beforeEach(async () => {
    schemaName = await createTestDbSchema();
  });

  afterEach(async () => {
    await dropTestDbSchema(schemaName);
  });

  const service = new DocSnapshotsService();

  describe('getStatus', () => {
    it('works', async () => {
      await service.getStatus(db, schemaName);
    });
  });
});
