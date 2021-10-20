import { retryBackoff } from 'backoff-rxjs';
import { inject, injectable } from 'inversify';
import {
  defer,
  filter,
  ObservableInput,
  share,
  startWith,
  takeUntil,
} from 'rxjs';
import { Observable, switchMap } from 'rxjs';
import { STOP_SIGNAL } from '../../../../framework/types';
import { getBroadcastCh$ } from '../../../../lib/utils';
import { DB_NAME } from '../../../DbExtension/types';
import type { ITransmittedChange } from '../../worker/repositories/SyncRepository';

@injectable()
export class DbEventsListenService {
  dbEvents$: Observable<ITransmittedChange[]>;
  newSyncPulls$: Observable<unknown>;

  constructor(
    @inject(DB_NAME) dbName: string,
    @inject(STOP_SIGNAL) private stop$: Observable<void>,
  ) {
    this.newSyncPulls$ = getBroadcastCh$(`${dbName}_syncPull`).pipe(
      switchMap((ch) => {
        return new Observable((subscriber) => {
          const func = () => {
            subscriber.next();
          };

          ch.addEventListener('message', func);

          return () => {
            ch.close();
          };
        });
      }),
      share(),
      takeUntil(this.stop$),
    );

    this.dbEvents$ = getBroadcastCh$(dbName).pipe(
      switchMap((ch) => {
        return new Observable<ITransmittedChange[]>((subscriber) => {
          const func = (evs: ITransmittedChange[]) => {
            subscriber.next(evs);
          };

          ch.addEventListener('message', func);

          return () => {
            ch.removeEventListener('message', func);
          };
        });
      }),
      share(),
      takeUntil(this.stop$),
    );
  }

  liveQuery<T extends any>(
    tables: string[],
    query: () => ObservableInput<T>,
    onlyInDb = true,
  ) {
    const filtered$ = this.dbEvents$.pipe(
      filter((evs) => {
        return Boolean(
          evs.find(
            ({ table, source }) =>
              (onlyInDb ? source === 'inDbChanges' : true) &&
              tables.includes(table),
          ),
        );
      }),
    );

    return filtered$.pipe(
      startWith(undefined),
      switchMap(() =>
        defer(() => query()).pipe(
          retryBackoff({
            initialInterval: 500,
            maxRetries: 5,
            resetOnSuccess: true,
          }),
        ),
      ),
      takeUntil(this.stop$),
    );
  }

  changesChannel$() {
    return this.dbEvents$;
  }

  newSyncPullsChannel$() {
    return this.newSyncPulls$;
  }
}
