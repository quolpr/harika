import { isEqual } from 'lodash-es';

export const getObjectDiff = (
  obj1: Record<string, any>,
  obj2: Record<string, any>,
) => {
  const from: Record<string, any> = {};
  const to: Record<string, any> = {};

  Object.entries(obj2).forEach(([k, v]) => {
    if (k in obj1) {
      if (!isEqual(obj1[k], v)) {
        to[k] = v;
      }
    } else {
      to[k] = v;
    }
  });

  Object.entries(obj1).forEach(([k, v]) => {
    if (k in to) {
      from[k] = v;
    }

    if (!(k in obj2)) {
      from[k] = v;
    }
  });

  return {
    from,
    to,
  };
};
