import { v4 } from 'uuid';
import {
  DatabaseChangeType,
  IAnyEntity,
  ICreateChange,
  IDeleteChange,
  IUpdateChange,
} from '../types';
import { EntitySnapshotBuilder } from './EntitySnapshotBuilder';

const buildCreateChange = <
  TableName extends string = string,
  T extends IAnyEntity = IAnyEntity
>(
  table: TableName,
  obj: T
): ICreateChange<TableName, T> => {
  return {
    id: v4(),
    type: DatabaseChangeType.Create,
    table: table,
    key: obj.id,
    obj,
  };
};

const buildUpdateChange = <
  TableName extends string = string,
  T extends IAnyEntity = IAnyEntity
>(
  table: TableName,
  key: string,
  from: Partial<T>,
  to: Partial<T>
): IUpdateChange<TableName, T> => {
  return {
    id: v4(),
    type: DatabaseChangeType.Update,
    table: table,
    key,
    from,
    to,
  };
};

const buildDeleteChange = <TableName extends string = string>(
  table: TableName,
  key: string
): IDeleteChange<TableName> => {
  return {
    id: v4(),
    type: DatabaseChangeType.Delete,
    table: table,
    key,
  };
};

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
