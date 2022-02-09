import { IDocChange, makeClientId } from '@harika/sync-common';

import {
  createChangeFactory,
  updateChangeFactory,
} from '../../../../test/supports/changeBuilders';
import {
  createTestDbSchema,
  dropTestDbSchema,
} from '../../../../test/supports/createDbSchema';
import { db } from '../../../db/db';
import { ChangesService } from './changesService';
import { DocSnapshotsService } from './DocSnapshotsService';
import { IncomingChangesHandler } from './IncomingChangesHandler';

describe('IncomingChangesHandler', () => {
  let schemaName!: string;

  const snapshotsService = new DocSnapshotsService();
  const changesService = new ChangesService();
  let incomingChangesHandler = new IncomingChangesHandler(
    db,
    changesService,
    snapshotsService
  );

  beforeEach(async () => {
    schemaName = await createTestDbSchema();
  });

  afterEach(async () => {
    await dropTestDbSchema(schemaName);
  });

  const changes = [
    createChangeFactory.build({
      doc: { id: '123', content: 'test' },
      timestamp: '2021-12-19T12:23:30.291Z-0000-8020e347364f2791',
    }),
    updateChangeFactory.build({
      docId: '123',
      from: { content: 'wow' },
      to: { childIds: [1, 2, 3], test: true },
      timestamp: '2021-12-19T12:23:30.291Z-0002-8020e347364f2791',
    }),
  ];
  const addableChanges = [
    updateChangeFactory.build({
      docId: '123',
      from: { childIds: [1, 2, 3], test: true },
      to: { content: 'kek' },
      timestamp: '2021-12-19T12:23:30.291Z-0003-8020e347364f2791',
    }),
  ];

  const addableChangesWithRecalculation = [
    updateChangeFactory.build({
      docId: '123',
      from: { id: '123', content: 'test' },
      to: { pog: true },
      // from the past
      timestamp: '2021-12-19T12:23:30.291Z-0001-8020e347364f2791',
    }),
  ];

  const handleChanges = async (chs: IDocChange[]) => {
    return await incomingChangesHandler.handleIncomeChanges(
      schemaName,
      makeClientId(),
      chs
    );
  };

  it('returns snapshot', async () => {
    expect(await handleChanges(changes)).toEqual([
      expect.objectContaining({
        doc: { id: '123', test: true, childIds: [1, 2, 3] },
        docId: '123',
        collectionName: 'testTable',
        isDeleted: false,
        scopeId: undefined,
        rev: 1,
      }),
    ]);
  });

  it('inserts snapshot', async () => {
    await handleChanges(changes);

    expect(
      await snapshotsService.getSnapshot(db, schemaName, 'testTable', '123')
    ).toEqual(expect.objectContaining({ docId: '123' }));
  });

  it('inserts changes', async () => {
    await handleChanges(changes);

    expect(
      (
        await changesService.getAllChanges(db, schemaName, 'testTable', '123')
      ).map(({ id }) => id)
    ).toEqual(expect.arrayContaining(changes.map((ch) => ch.id)));
  });

  describe('when snapshot already present', () => {
    it('handles addabe changes', async () => {
      await handleChanges(changes);
      await handleChanges(addableChanges);

      expect(
        await snapshotsService.getSnapshot(db, schemaName, 'testTable', '123')
      ).toEqual(
        expect.objectContaining({
          docId: '123',
          doc: expect.objectContaining({ content: 'kek' }),
        })
      );
    });
  });
  describe('when recalculation needed', () => {
    it('works', async () => {
      await handleChanges(changes);

      expect((await handleChanges(addableChangesWithRecalculation))[0]).toEqual(
        expect.objectContaining({
          docId: '123',
          doc: { pog: true, test: true, childIds: [1, 2, 3] },
        })
      );
    });
  });
});
