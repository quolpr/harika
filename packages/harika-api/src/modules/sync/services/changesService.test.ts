import { createChangeFactory } from '../../../../test/supports/changeBuilders';
import {
  createTestDbSchema,
  dropTestDbSchema,
} from '../../../../test/supports/createDbSchema';
import { db } from '../../../db/db';
import { ChangesService } from './changesService';

const collectionName = 'testTable';

describe('ChangesService', () => {
  let schemaName!: string;

  const insertWithTimestamp = (timestamp: string) => {
    return createChangeFactory.create(
      {
        doc: { id: '123' },
        timestamp: timestamp,
        collectionName: collectionName,
      },
      { transient: { schemaName } }
    );
  };

  const insertWithClientAndDocId = (clientId: string, docId: string) => {
    return createChangeFactory.create(
      {
        doc: { id: docId },
        collectionName: collectionName,
        receivedFromClientId: clientId,
      },
      { transient: { schemaName } }
    );
  };

  beforeEach(async () => {
    schemaName = await createTestDbSchema();
  });

  afterEach(async () => {
    await dropTestDbSchema(schemaName);
  });

  describe('isAnyChangeAfterClock', () => {
    it('return correct changes', async () => {
      const changesService = new ChangesService();

      const changes = await Promise.all([
        insertWithTimestamp('2021-12-05T11:39:47.186Z-0000-8d0ebac1d11da2f2'),
        insertWithTimestamp('2021-12-05T11:39:47.186Z-0001-8d0ebac1d11da2f2'),
        insertWithTimestamp('2021-12-05T11:39:47.189Z-0001-8d0ebac1d11da2f2'),
        insertWithTimestamp('2021-12-05T11:39:47.186Z-0000-b3baf8c6a05b6528'),
        insertWithTimestamp('2021-12-05T11:39:47.187Z-0000-b3baf8c6a05b6528'),
      ]);

      expect(
        await changesService.isAnyChangeAfterClock(
          db,
          schemaName,
          collectionName,
          '123',
          '2021-12-05T11:39:47.186Z-0001-8d0ebac1d11da2f2',
          [changes[1].id, changes[2].id, changes[4].id]
        )
      ).toEqual(false);

      expect(
        await changesService.isAnyChangeAfterClock(
          db,
          schemaName,
          collectionName,
          '123',
          '2021-12-05T11:39:47.186Z-0001-8d0ebac1d11da2f2',
          []
        )
      ).toEqual(true);

      expect(
        await changesService.isAnyChangeAfterClock(
          db,
          schemaName,
          collectionName,
          '123',
          '2021-12-06T11:39:47.186Z-0001-8d0ebac1d11da2f2',
          []
        )
      ).toEqual(false);
    });
  });

  describe('getClientIdsAfterRev', () => {
    it('when no changes from other clients returns empty array', async () => {
      const changesService = new ChangesService();

      await Promise.all([
        insertWithClientAndDocId('123', '123'),
        insertWithClientAndDocId('123', '123'),
      ]);

      expect(
        await changesService.getDocIdsAfterRevExceptSelf(
          db,
          schemaName,
          0,
          '123'
        )
      ).toEqual([]);
    });

    it('when no changes from other clients returns empty array', async () => {
      const changesService = new ChangesService();

      await Promise.all([
        insertWithClientAndDocId('123', '111'),
        insertWithClientAndDocId('345', '222'),
        insertWithClientAndDocId('567', '333'),
        insertWithClientAndDocId('789', '333'),
      ]);

      expect(
        await changesService.getDocIdsAfterRevExceptSelf(
          db,
          schemaName,
          0,
          '123'
        )
      ).toEqual(['222', '333']);
    });
  });
});
