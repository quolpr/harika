import { withoutUndo as withoutUndoFunc } from 'mobx-keystone';

export function withoutUndoAction(
  _target: any,
  _propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  let originalMethod = descriptor.value;

  //wrapping the original method
  descriptor.value = function (...args: any[]) {
    let result: any;

    withoutUndoFunc(() => {
      result = originalMethod.apply(this, args);
    });

    return result;
  };
}
