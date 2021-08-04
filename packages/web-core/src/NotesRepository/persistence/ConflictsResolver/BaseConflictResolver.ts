import {
  DatabaseChangeType,
  IDatabaseChange,
  IDeleteChange,
  IUpdateChange,
} from '../../../dexieTypes';
import { reduceChanges } from '../../../dexie-sync/reduceChanges';

export abstract class BaseConflictResolver<
  T extends string,
  K extends Record<string, any>,
> {
  resolveConflicts(
    clientChanges: IDatabaseChange<T, K>[],
    serverChanges: IDatabaseChange<T, K>[],
  ) {
    const reducedClientChanges = reduceChanges(clientChanges) as Record<
      string,
      IDatabaseChange<T, K>
    >;
    const reducedServerChanges = reduceChanges(serverChanges) as Record<
      string,
      IDatabaseChange<T, K>
    >;

    const notConflictedServerChanges: Record<
      string,
      IDatabaseChange<T, K>
    > = {};
    const conflictedChanges: Record<string, IDatabaseChange<T, K>> = {};

    Object.entries(reducedClientChanges).forEach(([key, clientChange]) => {
      if (!reducedServerChanges[key]) {
        return;
      }

      conflictedChanges[key] = this.resolveConflictedChanges(
        clientChange,
        reducedServerChanges[key],
      );
    });

    Object.entries(reducedServerChanges).forEach(([key, serverChange]) => {
      if (!conflictedChanges[key]) {
        notConflictedServerChanges[key] = serverChange;
      }
    });

    return {
      conflictedChanges: Object.values(conflictedChanges),
      notConflictedServerChanges: Object.values(notConflictedServerChanges),
    };
  }

  private resolveConflictedChanges(
    clientChange: IDatabaseChange<T, K>,
    serverChange: IDatabaseChange<T, K>,
  ): IDatabaseChange<T, K> {
    switch (clientChange.type) {
      case DatabaseChangeType.Create: {
        return clientChange;
      }

      case DatabaseChangeType.Update: {
        switch (serverChange.type) {
          case DatabaseChangeType.Create: {
            return serverChange;
          }

          case DatabaseChangeType.Update: {
            return this.resolveUpdateUpdate(clientChange, serverChange);
          }

          case DatabaseChangeType.Delete: {
            return this.resolveUpdateDelete(clientChange, serverChange);
          }
        }

        break;
      }

      case DatabaseChangeType.Delete: {
        switch (serverChange.type) {
          case DatabaseChangeType.Create: {
            return serverChange;
          }

          case DatabaseChangeType.Update: {
            return this.resolveUpdateDelete(serverChange, clientChange);
          }

          case DatabaseChangeType.Delete: {
            return clientChange;
          }
        }
      }
    }
  }

  protected abstract resolveUpdateUpdate(
    change1: IUpdateChange<T, K>,
    change2: IUpdateChange<T, K>,
  ): IUpdateChange<T, K>;

  protected abstract resolveUpdateDelete(
    change1: IUpdateChange<T, K>,
    change2: IDeleteChange<T, K>,
  ): IDatabaseChange<T, K>;
}
