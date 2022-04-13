import { AnyModel, createContext, onPatches } from 'mobx-keystone';
import { Subject } from 'rxjs';

let withoutSyncVal = false;

export const withoutChangeTracking = <T extends any>(func: () => T): T => {
  const prevValue = withoutSyncVal;
  withoutSyncVal = true;

  try {
    return func();
  } finally {
    withoutSyncVal = prevValue;
  }
};

export function withoutChangeTrackingAction(
  _target: any,
  _propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  let originalMethod = descriptor.value;

  //wrapping the original method
  descriptor.value = function (...args: any[]) {
    return withoutChangeTracking(() => {
      return originalMethod.apply(this, args);
    });
  };
}

export enum ModelChangeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export type ITrackChangeModel<T> = T & {
  $modelId: string;
  $modelType: string;
};

export type IModelChange<T extends AnyModel = AnyModel> = {
  type: ModelChangeType;
  model: ITrackChangeModel<T>;
};

export const trackChangesPipeCtx = createContext<Subject<IModelChange>>();

export const trackChanges = (constructor: Function) => {
  const originalAttached = constructor.prototype.onAttachedToRootStore;

  constructor.prototype.onAttachedToRootStore = function () {
    const model = this;

    const disposer = originalAttached
      ? originalAttached.bind(this)?.()
      : undefined;

    const pipe$ = trackChangesPipeCtx.get(model);

    if (!pipe$) {
      console.error(constructor, model);
      throw new Error('Did you forget to set trackChangesPipeCtx?');
    }

    if (!withoutSyncVal) {
      pipe$.next({
        type: ModelChangeType.Create,
        model,
      });
    }

    // TODO: not sure that such thing will be good for performance,
    // but somehow we need to react only on the whole state tree value changes
    const patchesDisposer = onPatches(model, () => {
      if (withoutSyncVal) return;

      pipe$.next({
        type: ModelChangeType.Update,
        model,
      });
    });

    return () => {
      patchesDisposer();
      disposer?.();

      if (withoutSyncVal) return;

      pipe$.next({
        type: ModelChangeType.Delete,
        model,
      });
    };
  };
};
