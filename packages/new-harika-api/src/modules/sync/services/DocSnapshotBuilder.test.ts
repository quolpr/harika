import {
  updateChangeFactory,
  createChangeFactory,
  deleteChangeFactory,
} from '../../../../test/supports/changeBuilders';
import { EntitySnapshotBuilder } from './DocSnapshotBuilder';

describe('EntitySnapshotBuilder', () => {
  it('works', () => {
    expect(
      EntitySnapshotBuilder.build([
        createChangeFactory.build({
          doc: {
            id: '123',
            content: 'test',
          },
        }),
        updateChangeFactory.build({
          docId: '123',
          from: { content: 'wow' },
          to: { childIds: [1, 2, 3], test: true },
        }),
      ])
    ).toStrictEqual({
      testTable: {
        '123': {
          entity: {
            id: '123',
            childIds: [1, 2, 3],
            test: true,
          },
          isDeleted: false,
        },
      },
    });
  });

  it('works with array', () => {
    expect(
      EntitySnapshotBuilder.build([
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
    ).toStrictEqual({
      testTable: {
        '123': {
          entity: {
            id: '123',
            content: 'test',
            childIds: [1, 4],
          },
          isDeleted: false,
        },
      },
    });
  });

  it('works with nested objs', () => {
    expect(
      EntitySnapshotBuilder.build([
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
    ).toStrictEqual({
      testTable: {
        '123': {
          entity: {
            id: '123',
            content: 'test',
            nested: {
              childIds: [1, 4],
              test: true,
            },
          },
          isDeleted: false,
        },
      },
    });
  });

  it('works with delete', () => {
    EntitySnapshotBuilder.build([
      createChangeFactory.build({ doc: { id: '123', content: 'test' } }),
      deleteChangeFactory.build({ docId: '123' }),
    ]);
  });
});
