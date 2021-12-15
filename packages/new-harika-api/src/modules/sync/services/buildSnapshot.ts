import {
  DocChangeType,
  IDocChangeWithRev,
  IDocSnapshot,
  WithRev,
} from '@harika/sync-common';
import {
  isArray,
  isPlainObject,
  cloneDeep,
  differenceWith,
  isEqual,
  uniqWith,
} from 'lodash';

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

      if (removedIds.length === 0 && addedIds.length === 0 && v !== undefined) {
        current[k as keyof T] = v as T[keyof T];
      } else {
        current[k as keyof T] = uniqWith(
          (v || [])
            .concat(current[k] === undefined ? [] : current[k])
            .filter((v: any) => !removedIds.find((v2) => isEqual(v, v2))),
          isEqual
        ) as T[keyof T];
      }

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

export const buildSnapshot = (
  changes: IDocChangeWithRev[]
): WithRev<IDocSnapshot> => {
  let currentSnapshot: WithRev<IDocSnapshot> | undefined;

  changes.forEach((ch) => {
    if (ch.type === DocChangeType.Create) {
      if (currentSnapshot) {
        throw new Error(`Multiple create changes for ${JSON.stringify(ch)}`);
      }

      currentSnapshot = {
        doc: ch.doc,
        docId: ch.docId,
        collectionName: ch.collectionName,
        isDeleted: false,
        lastTimestamp: ch.timestamp,
        scopeId: ch.scopeId,
        rev: ch.rev,
      };

      return;
    }

    if (!currentSnapshot || !currentSnapshot.doc) {
      throw new Error(
        `Couldn't apply change ${JSON.stringify(
          ch
        )} due to snapshot or doc is missed ${JSON.stringify(currentSnapshot)}`
      );
    }

    if (ch.type === DocChangeType.Update) {
      currentSnapshot.doc = handleUpdate(currentSnapshot.doc, {
        from: ch.from,
        to: ch.to,
      });
    }

    if (ch.type === DocChangeType.Delete) {
      currentSnapshot.isDeleted = true;
    }

    currentSnapshot.lastTimestamp = ch.timestamp;
    currentSnapshot.scopeId = ch.scopeId;
    currentSnapshot.rev = Math.max(currentSnapshot.rev, ch.rev);
  });

  return currentSnapshot;
};
