import { makeClientId } from '@harika/sync-common';
import {
  updateChangeFactory,
  createChangeFactory,
} from '../../../../test/supports/changeBuilders';
import {
  createTestDbSchema,
  dropTestDbSchema,
} from '../../../../test/supports/createDbSchema';
import { pg } from '../../../plugins/db';
import { ChangesService } from './changesService';
import { DocSnapshotRebuilder } from './DocSnapshotRebuilder';
import { DocSnapshotsService } from './DocSnapshotsService';
import { IncomingChangesHandler } from './IncomingChangesHandler';

describe('IncomingChangesHandler', () => {
  let schemaName!: string;

  const snapshotsService = new DocSnapshotsService();
  const changesService = new ChangesService();
  let incomingChangesHandler = new IncomingChangesHandler(
    pg,
    changesService,
    new DocSnapshotRebuilder(changesService, snapshotsService),
    snapshotsService
  );

  beforeEach(async () => {
    schemaName = await createTestDbSchema();
  });

  afterEach(async () => {
    await dropTestDbSchema(schemaName);
  });

  const changes = [
    createChangeFactory.build({ doc: { id: '123', content: 'test' } }),
    updateChangeFactory.build({
      docId: '123',
      from: { content: 'wow' },
      to: { childIds: [1, 2, 3], test: true },
    }),
  ];

  const handleChanges = async () => {
    return await incomingChangesHandler.handleIncomeChanges(
      schemaName,
      makeClientId(),
      changes
    );
  };

  it('returns snapshot', async () => {
    expect(await handleChanges()).toEqual([
      expect.objectContaining({
        doc: { id: '123', test: true, childIds: [1, 2, 3] },
        docId: '123',
        collectionName: 'testTable',
        isDeleted: false,
        scopeId: null,
        rev: 1,
      }),
    ]);
  });

  it('inserts snapshot', async () => {
    await handleChanges();

    expect(
      await snapshotsService.getSnapshot(pg, schemaName, 'testTable', '123')
    ).toEqual(expect.objectContaining({ docId: '123' }));
  });

  it('inserts changes', async () => {
    await handleChanges();

    expect(
      (
        await changesService.getAllChanges(pg, schemaName, 'testTable', '123')
      ).map(({ id }) => id)
    ).toEqual(expect.arrayContaining(changes.map((ch) => ch.id)));
  });
});
