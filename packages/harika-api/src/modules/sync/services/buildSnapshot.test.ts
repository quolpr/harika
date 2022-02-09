import {
  createChangeFactory,
  deleteChangeFactory,
  updateChangeFactory,
} from '../../../../test/supports/changeBuilders';
import { buildSnapshot } from './buildSnapshot';

describe('EntitySnapshotBuilder', () => {
  it('works', () => {
    const lastChange = updateChangeFactory.build({
      docId: '123',
      from: { content: 'wow' },
      to: { childIds: [1, 2, 3], test: true },
      rev: 150,
    });

    expect(
      buildSnapshot([
        createChangeFactory.build({
          doc: {
            id: '123',
            content: 'test',
          },
        }),
        lastChange,
      ])
    ).toStrictEqual({
      collectionName: 'testTable',
      doc: {
        id: '123',
        childIds: [1, 2, 3],
        test: true,
      },
      docId: '123',
      lastTimestamp: lastChange.timestamp,
      isDeleted: false,
      scopeId: undefined,
      rev: lastChange.rev,
    });
  });

  it('works with array', () => {
    expect(
      buildSnapshot([
        createChangeFactory.build({ doc: { id: '123', content: 'test' } }),
        updateChangeFactory.build({
          docId: '123',
          from: {},
          to: { childIds: [1, 2, 3] },
        }),
        updateChangeFactory.build({
          docId: '123',
          from: { childIds: [2, 3] },
          to: { childIds: [4] },
        }),
      ])
    ).toEqual(
      expect.objectContaining({
        doc: {
          id: '123',
          content: 'test',
          childIds: [4, 1],
        },
        isDeleted: false,
      })
    );
  });

  it('works with nested objs', () => {
    expect(
      buildSnapshot([
        createChangeFactory.build({ doc: { id: '123', content: 'test' } }),
        updateChangeFactory.build({
          docId: '123',
          from: {},
          to: { nested: { childIds: [1, 2, 3] } },
        }),
        updateChangeFactory.build({
          docId: '123',
          from: { nested: { childIds: [2, 3] } },
          to: { nested: { childIds: [4], test: true } },
        }),
      ])
    ).toEqual(
      expect.objectContaining({
        doc: {
          id: '123',
          content: 'test',
          nested: {
            childIds: [4, 1],
            test: true,
          },
        },
        isDeleted: false,
      })
    );
  });

  it('works with delete', () => {
    expect(
      buildSnapshot([
        createChangeFactory.build({ doc: { id: '123', content: 'test' } }),
        deleteChangeFactory.build({ docId: '123' }),
      ])
    ).toEqual(
      expect.objectContaining({
        doc: {
          id: '123',
          content: 'test',
        },
        isDeleted: true,
      })
    );
  });

  it('works with multiple create even if deleted', () => {
    expect(
      buildSnapshot([
        createChangeFactory.build({ doc: { id: '123', content: 'test' } }),
        deleteChangeFactory.build({ docId: '123' }),
        createChangeFactory.build({ doc: { id: '123', content: 'test-puk' } }),
      ])
    ).toEqual(
      expect.objectContaining({
        doc: {
          id: '123',
          content: 'test-puk',
        },
        isDeleted: false,
      })
    );
  });
});
