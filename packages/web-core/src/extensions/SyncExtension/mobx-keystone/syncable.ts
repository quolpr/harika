import { AnyModel, onPatches } from 'mobx-keystone';
import { Subject } from 'rxjs';

let withoutSyncVal = false;

export const withoutSync = <T extends any>(func: () => T): T => {
  const prevValue = withoutSyncVal;
  withoutSyncVal = true;

  try {
    return func();
  } finally {
    withoutSyncVal = prevValue;
  }
};

export function withoutSyncAction(
  _target: any,
  _propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  let originalMethod = descriptor.value;

  //wrapping the original method
  descriptor.value = function (...args: any[]) {
    return withoutSync(() => {
      return originalMethod.apply(this, args);
    });
  };
}

export enum SyncableModelChangeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export type ISyncableModel<T> = T & {
  $modelId: string;
  $modelType: string;
};

export type ISyncableModelChange<T extends AnyModel = AnyModel> = {
  type: SyncableModelChangeType;
  model: ISyncableModel<T>;
};

export const syncableModelChangesPipe$ = new Subject<ISyncableModelChange>();

export const syncable = (constructor: Function) => {
  const originalAttached = constructor.prototype.onAttachedToRootStore;

  constructor.prototype.onAttachedToRootStore = function () {
    const model = this;

    const disposer = originalAttached?.();

    if (!withoutSyncVal) {
      syncableModelChangesPipe$.next({
        type: SyncableModelChangeType.Create,
        model,
      });
    }

    // TODO: not sure that such thing will be good for performance,
    // but somehow we need to react only on the whole state tree value changes
    const patchesDisposer = onPatches(model, () => {
      if (withoutSyncVal) return;

      syncableModelChangesPipe$.next({
        type: SyncableModelChangeType.Update,
        model,
      });
    });

    return () => {
      patchesDisposer();
      disposer?.();

      if (withoutSyncVal) return;

      syncableModelChangesPipe$.next({
        type: SyncableModelChangeType.Delete,
        model,
      });
    };
  };
};
