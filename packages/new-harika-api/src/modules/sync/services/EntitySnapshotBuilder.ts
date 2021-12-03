import { DatabaseChangeType, IAnyEntity, IDatabaseChange } from '../types';
import {
  isArray,
  isPlainObject,
  cloneDeep,
  differenceWith,
  isEqual,
  uniqWith,
} from 'lodash';

interface ISnapshotBuilderResult {
  [tableName: string]: {
    [id: string]: {
      entity: IAnyEntity;
      isDeleted: boolean;
    };
  };
}

const handleUpdate = <T extends Record<string, any>>(
  current: T,
  change: { from: Partial<T>; to: Partial<T> }
) => {
  current = cloneDeep(current);

  Object.values(current).forEach((v) => {
    if (isArray(v)) {
      if (uniqWith(v, isEqual).length !== v.length) {
        throw new Error(
          `Only uniq arrays are supported in ${JSON.stringify(current)}`
        );
      }
    }
  });

  Object.entries(change.to).forEach(([k, v]) => {
    if (isArray(v)) {
      // TODO: better object array support. I think we could add `key` field
      // to the array elements with object type. Then we could detect the diff of the nested objects
      // ALSO!!! array elements should be uniq
      const removedIds = differenceWith(change.from[k], change.to[k], isEqual);
      const addedIds = differenceWith(change.to[k], change.from[k], isEqual);

      current[k as keyof T] = uniqWith(
        (current[k] || [])
          .concat(addedIds)
          .filter((v: any) => !removedIds.find((v2) => isEqual(v, v2))),
        isEqual
      ) as T[keyof T];

      return;
    }

    if (isPlainObject(v)) {
      current[k as keyof T] = handleUpdate(
        (current[k as keyof T] || {}) as T[keyof T],
        {
          from: change.from[k as keyof T] || {},
          to: change.to[k as keyof T],
        }
      );

      return;
    }

    current[k as keyof T] = v;
  });

  Object.entries(change.from).forEach(([k, v]) => {
    if (v !== undefined && change.to[k] === undefined) {
      delete current[k as keyof T];
    }
  });

  return current;
};

export class EntitySnapshotBuilder {
  static build(changes: IDatabaseChange[]): ISnapshotBuilderResult {
    const registry: ISnapshotBuilderResult = {};

    changes.forEach((ch) => {
      if (ch.type === DatabaseChangeType.Create) {
        if (!registry[ch.table]) {
          registry[ch.table] = {};
        }

        if (registry[ch.table][ch.key]) {
          throw new Error(`Multiple create changes for ${JSON.stringify(ch)}`);
        }

        registry[ch.table][ch.key] = { entity: ch.obj, isDeleted: false };

        return;
      }

      const currentState = registry[ch.table][ch.key];
      if (!currentState || !currentState.entity) {
        throw new Error(
          `Couldn't apply change ${JSON.stringify(
            ch
          )} due to entity is missed in ${JSON.stringify(registry)}`
        );
      }

      if (ch.type === DatabaseChangeType.Update) {
        currentState.entity = handleUpdate(currentState.entity, {
          from: ch.from,
          to: ch.to,
        });
      }

      if (ch.type === DatabaseChangeType.Delete) {
        currentState.isDeleted = true;
      }
    });

    return registry;
  }
}
