import { isArray, isEqual } from 'lodash-es';
import { getSnapshot, Ref } from 'mobx-keystone';

export const applyModelData = (model: any, data: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(data)) {
    if (isEqual(getSnapshot(model[key]), value)) continue;

    if (value instanceof Ref) {
      if (value.id === (model[key] as Ref<any> | undefined)?.id) {
        continue;
      }
    }

    if (isArray(value) && value.every((v) => v instanceof Ref)) {
      if (
        isEqual(
          ((model[key] || []) as Array<Ref<any>>).map(({ id }) => id),
          value.map(({ id }) => id),
        )
      ) {
        continue;
      }
    }

    model[key] = value;
  }
};
