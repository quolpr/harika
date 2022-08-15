import { autorun } from 'mobx';
import { Observable } from 'rxjs';

export const toObserver = <T>(obj: () => T) => {
  return new Observable<T>(function (observer) {
    const dispose = autorun(() => {
      observer.next(obj());
    });

    return () => dispose();
  });
};
