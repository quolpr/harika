import { withoutUndo as withoutUndoFunc } from 'mobx-keystone';

export function withoutUndoAction(
  _target: any,
  _propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  let originalMethod = descriptor.value;

  //wrapping the original method
  descriptor.value = function (...args: any[]) {
    return withoutUndoFunc(() => {
      return originalMethod.apply(this, args);
    });
  };
}
