import type Dexie from 'dexie';
import { Observable, ObservableInput } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

export const onDexieChange = (db: Dexie, table: string): Observable<void> => {
  return new Observable((observer) => {
    // TODO: how to usubscribe?

    db.on('changes', (changes) => {
      for (const change of changes) {
        if (change.table === table) {
          observer.next();
          return;
        }
      }
    });
  });
};

export const liveSwitch = <T extends ObservableInput<any>>(
  toSwitch: () => T,
) => {
  return <K>(source: Observable<K>) => {
    return source.pipe(startWith(undefined), switchMap(toSwitch));
  };
};
