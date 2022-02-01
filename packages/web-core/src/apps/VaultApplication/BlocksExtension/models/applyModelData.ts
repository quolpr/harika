import { isArray, isEqual } from 'lodash-es';
import { BaseModel, getSnapshot, Ref } from 'mobx-keystone';

export const applyModelData = <R extends { [k: string]: any }>(
  model: BaseModel<R, any, any, any, any>,
  data: R,
  customMapper: <T extends keyof R>(
    key: T,
    oldVal: R[T],
    newVal: R[T],
  ) => R[keyof R] = (_k, _oldVal, newVal) => newVal,
) => {
  for (const [key, value] of Object.entries(data)) {
    if (isEqual(getSnapshot(model.$[key]), value)) continue;

    if (value instanceof Ref) {
      if (value.id === (model.$[key] as Ref<any> | undefined)?.id) {
        continue;
      }
    }

    if (isArray(value) && value.every((v) => v instanceof Ref)) {
      if (
        isEqual(
          ((model.$[key] || []) as Array<Ref<any>>).map(({ id }) => id),
          value.map(({ id }) => id),
        )
      ) {
        continue;
      }
    }

    // @ts-expect-error
    model[key] = customMapper(
      key as keyof R,
      model.$[key] as R[keyof R],
      value as R[keyof R],
    );
  }
};
