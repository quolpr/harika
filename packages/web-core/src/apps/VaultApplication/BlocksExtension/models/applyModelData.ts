import { isArray, isEqual } from 'lodash-es';
import { BaseModel, getSnapshot, Ref } from 'mobx-keystone';

// Not sure how to make it type safe
export const applyModelData = (
  model: BaseModel<any, any, any, any>,
  data: any,
  customMapper: (key: any, oldVal: any, newVal: any) => any = (
    _k,
    _oldVal,
    newVal,
  ) => newVal,
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

    // @ts-ignore
    model[key] = customMapper(key, model.$[key], value);
  }
};
