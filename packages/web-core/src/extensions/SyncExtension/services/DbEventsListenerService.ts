import { retryBackoff } from 'backoff-rxjs';
import { BroadcastChannel } from 'broadcast-channel';
import { inject, injectable } from 'inversify';
import {
  debounce,
  debounceTime,
  defer,
  filter,
  ObservableInput,
  ReplaySubject,
  share,
  startWith,
  takeUntil,
} from 'rxjs';
import { Observable, switchMap } from 'rxjs';
import { STOP_SIGNAL } from '../../../framework/types';
import { DB_NAME } from '../../DbExtension/types';
import type { ITransmittedChange } from '../persistence/SyncRepository';

@injectable()
export class DbEventsListenService {
  dbEvents$: Observable<ITransmittedChange[]>;
  newSyncPulls$: Observable<unknown>;

  constructor(
    @inject(DB_NAME) dbName: string,
    @inject(STOP_SIGNAL) private stop$: Observable<void>,
  ) {
    this.newSyncPulls$ = this.createChannel$(`${dbName}_syncPull`).pipe(
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

    this.dbEvents$ = this.createChannel$(dbName).pipe(
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

  private createChannel$(name: string) {
    return new Observable<BroadcastChannel>((sub) => {
      let currentChannel: BroadcastChannel | undefined = undefined;

      const createChannel = () => {
        currentChannel = new BroadcastChannel(name, {
          webWorkerSupport: true,
          idb: {
            onclose: () => {
              // the onclose event is just the IndexedDB closing.
              // you should also close the channel before creating
              // a new one.
              currentChannel?.close();
              createChannel();
            },
          },
        });

        sub.next(currentChannel);
      };

      createChannel();

      return () => {
        currentChannel?.close();
      };
    }).pipe(
      share({
        connector: () => new ReplaySubject(1),
      }),
      takeUntil(this.stop$),
    );
  }
}
