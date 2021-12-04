import {
  buildCreateChange,
  buildDeleteChange,
  buildUpdateChange,
} from '../../../../test/supports/changeBuilders';
import { EntitySnapshotBuilder } from './EntitySnapshotBuilder';

describe('EntitySnapshotBuilder', () => {
  it('works', () => {
    expect(
      EntitySnapshotBuilder.build([
        buildCreateChange('wow', { id: '123', content: 'test' }),
        buildUpdateChange(
          'wow',
          '123',
          { content: 'wow' },
          { childIds: [1, 2, 3], test: true }
        ),
      ])
    ).toStrictEqual({
      wow: {
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
        buildCreateChange('wow', { id: '123', content: 'test' }),
        buildUpdateChange('wow', '123', {}, { childIds: [1, 2, 3] }),
        buildUpdateChange(
          'wow',
          '123',
          { childIds: [2, 3] },
          { childIds: [4] }
        ),
      ])
    ).toStrictEqual({
      wow: {
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
        buildCreateChange('wow', { id: '123', content: 'test' }),
        buildUpdateChange(
          'wow',
          '123',
          {},
          { nested: { childIds: [1, 2, 3] } }
        ),
        buildUpdateChange(
          'wow',
          '123',
          { nested: { childIds: [2, 3] } },
          { nested: { childIds: [4], test: true } }
        ),
      ])
    ).toStrictEqual({
      wow: {
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
      buildCreateChange('wow', { id: '123', content: 'test' }),
      buildDeleteChange('wow', '123'),
    ]);
  });
});
