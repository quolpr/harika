import { createChangeFactory } from '../../../../test/supports/changeBuilders';
import {
  createTestDbSchema,
  dropTestDbSchema,
} from '../../../../test/supports/createDbSchema';
import { pg } from '../../../plugins/db';
import { ChangesService } from './changesService';

describe('ChangesService', () => {
  let schemaName!: string;

  beforeEach(async () => {
    schemaName = await createTestDbSchema();
  });

  afterEach(async () => {
    await dropTestDbSchema(schemaName);
  });

  describe('getIsAnyChangeNotInRangeAfterClock', () => {
    it('returns true if any change', async () => {});

    it('returns true if no changes', async () => {});
  });

  it('return correct changes', async () => {
    const changesService = new ChangesService(pg, schemaName);

    const tableName = 'testTable';

    const timestamps = [
      '2021-12-05T11:39:47.186Z-0000-8d0ebac1d11da2f2',
      '2021-12-05T11:39:47.186Z-0001-8d0ebac1d11da2f2',
      '2021-12-05T11:39:47.189Z-0001-8d0ebac1d11da2f2',
      '2021-12-05T11:39:47.186Z-0000-b3baf8c6a05b6528',
      '2021-12-05T11:39:47.187Z-0000-b3baf8c6a05b6528',
    ];

    await Promise.all(
      timestamps.map((t) =>
        createChangeFactory.create(
          {
            doc: { id: '123' },
            timestamp: t,
            collectionName: tableName,
          },
          { transient: { schemaName } }
        )
      )
    );

    expect(
      (
        await changesService.getChangesAfterOrEqualClock(
          tableName,
          '2021-12-05T11:39:47.186Z-0001-8d0ebac1d11da2f2'
        )
      ).map(({ timestamp }) => timestamp)
    ).toEqual(
      expect.arrayContaining([
        '2021-12-05T11:39:47.186Z-0001-8d0ebac1d11da2f2',
        '2021-12-05T11:39:47.189Z-0001-8d0ebac1d11da2f2',
        '2021-12-05T11:39:47.187Z-0000-b3baf8c6a05b6528',
      ])
    );
  });
});
