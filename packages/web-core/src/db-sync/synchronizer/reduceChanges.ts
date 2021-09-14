import { DatabaseChangeType } from '../../dexieTypes';
import type {
  ICreateChange,
  IDatabaseChange,
  IUpdateChange,
} from '../../dexieTypes';
import { cloneDeep, set } from 'lodash-es';

export function reduceChanges(changes: IDatabaseChange[]) {
  // Converts an Array of change objects to a set of change objects based on its unique combination of (table ":" key).
  // If several changes were applied to the same object, the resulting set will only contain one change for that object.
  return changes.reduce(function (set, nextChange) {
    const id = nextChange.table + ':' + nextChange.key;
    const prevChange = set[id];
    if (!prevChange) {
      // This is the first change on this key. Add it unless it comes from the source that we are working against
      set[id] = nextChange;
    } else {
      // Merge the oldchange with the new change
      set[id] = (function () {
        switch (prevChange.type) {
          case DatabaseChangeType.Create:
            switch (nextChange.type) {
              case DatabaseChangeType.Create:
                return nextChange; // Another CREATE replaces previous CREATE.
              case DatabaseChangeType.Update:
                return combineCreateAndUpdate(prevChange, nextChange); // Apply nextChange.mods into prevChange.obj
              case DatabaseChangeType.Delete:
                return nextChange; // Object created and then deleted. If it wasnt for that we MUST handle resent changes, we would skip entire change here. But what if the CREATE was sent earlier, and then CREATE/DELETE at later stage? It would become a ghost object in DB. Therefore, we MUST keep the delete change! If object doesnt exist, it wont harm!
            }
            break;
          case DatabaseChangeType.Update:
            switch (nextChange.type) {
              case DatabaseChangeType.Create:
                return nextChange; // Another CREATE replaces previous update.
              case DatabaseChangeType.Update:
                return combineUpdateAndUpdate(prevChange, nextChange); // Add the additional modifications to existing modification set.
              case DatabaseChangeType.Delete:
                return nextChange; // Only send the delete change. What was updated earlier is no longer of interest.
            }
            break;
          case DatabaseChangeType.Delete:
            switch (nextChange.type) {
              case DatabaseChangeType.Create:
                return nextChange; // A resurection occurred. Only create change is of interest.
              case DatabaseChangeType.Update:
                return prevChange; // Nothing to do. We cannot update an object that doesnt exist. Leave the delete change there.
              case DatabaseChangeType.Delete:
                return prevChange; // Still a delete change. Leave as is.
            }
            break;
        }
      })();
    }
    return set;
  }, {} as Record<string, IDatabaseChange>);
}

function combineCreateAndUpdate(
  prevChange: ICreateChange,
  nextChange: IUpdateChange,
) {
  const clonedChange = cloneDeep(prevChange); // Clone object before modifying since the earlier change in db.changes[] would otherwise be altered.
  applyModifications(clonedChange.obj, nextChange.to); // Apply modifications to existing object.
  return clonedChange;
}

function applyModifications(obj: Object, modifications: IUpdateChange['to']) {
  Object.keys(modifications).forEach(function (keyPath) {
    set(obj, keyPath, modifications[keyPath]);
  });
}

function combineUpdateAndUpdate(
  prevChange: IUpdateChange,
  nextChange: IUpdateChange,
) {
  const clonedChange = cloneDeep(prevChange); // Clone object before modifying since the earlier change in db.changes[] would otherwise be altered.
  Object.keys(nextChange.to).forEach(function (keyPath) {
    // If prev-change was changing a parent path of this keyPath, we must update the parent path rather than adding this keyPath
    let hadParentPath = false;
    Object.keys(prevChange.to)
      .filter(function (parentPath) {
        return keyPath.indexOf(parentPath + '.') === 0;
      })
      .forEach(function (parentPath) {
        set(
          clonedChange.to[parentPath],
          keyPath.substr(parentPath.length + 1),
          nextChange.to[keyPath],
        );
        hadParentPath = true;
      });
    if (!hadParentPath) {
      // Add or replace this keyPath and its new value
      clonedChange.to[keyPath] = nextChange.to[keyPath];
    }
    // In case prevChange contained sub-paths to the new keyPath, we must make sure that those sub-paths are removed since
    // we must mimic what would happen if applying the two changes after each other:
    Object.keys(prevChange.to)
      .filter(function (subPath) {
        return subPath.indexOf(keyPath + '.') === 0;
      })
      .forEach(function (subPath) {
        delete clonedChange.to[subPath];
      });
  });
  return clonedChange;
}
