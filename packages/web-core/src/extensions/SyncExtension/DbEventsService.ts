import { BroadcastChannel } from 'broadcast-channel';
import { inject, injectable } from 'inversify';
import type { ObservableInput } from 'rxjs';
import { Observable, switchMap } from 'rxjs';
import { DB_NAME } from '../DbExtension/types';
import type { ITransmittedChange } from './persistence/SyncRepository';

@injectable()
export class DbEventsService {
  dbEventsChannel: BroadcastChannel;
  newSyncPullsChannel: BroadcastChannel;

  constructor(@inject(DB_NAME) private dbName: string) {
    this.dbEventsChannel = new BroadcastChannel(dbName, {
      webWorkerSupport: true,
    });

    this.newSyncPullsChannel = new BroadcastChannel(`${dbName}_syncPull`, {
      webWorkerSupport: true,
    });
  }

  liveQuery<T extends any>(
    tables: string[],
    query: () => ObservableInput<T>,
    onlyInDb = true,
  ) {
    return new Observable((subscriber) => {
      const func = (evs: ITransmittedChange[]) => {
        if (
          evs.find(
            ({ table, source }) =>
              (onlyInDb ? source === 'inDbChanges' : true) &&
              tables.includes(table),
          )
        ) {
          subscriber.next();
        }
      };
      this.dbEventsChannel.addEventListener('message', func);

      subscriber.next();

      return () => this.dbEventsChannel.removeEventListener('message', func);
    }).pipe(switchMap(() => query()));
  }

  changesChannel$() {
    return new Observable<ITransmittedChange[]>((subscriber) => {
      const func = (evs: ITransmittedChange[]) => {
        subscriber.next(evs);
      };

      this.dbEventsChannel.addEventListener('message', func);

      return () => this.dbEventsChannel.removeEventListener('message', func);
    });
  }

  newSyncPullsChannel$() {
    return new Observable<unknown>((subscriber) => {
      const func = () => {
        subscriber.next();
      };

      this.newSyncPullsChannel.addEventListener('message', func);

      return () =>
        this.newSyncPullsChannel.removeEventListener('message', func);
    });
  }
}
