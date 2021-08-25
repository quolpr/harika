import { BroadcastChannel } from 'broadcast-channel';
import { Observable, ObservableInput, switchMap } from 'rxjs';
import type { IExtendedDatabaseChange } from './SqlNotesRepository.worker';

export class DbEventsService {
  dbEventsChannel: BroadcastChannel;

  constructor(dbName: string) {
    this.dbEventsChannel = new BroadcastChannel(dbName, {
      webWorkerSupport: true,
    });
  }

  liveQuery<T extends any>(tables: string[], query: () => ObservableInput<T>) {
    return new Observable((subscriber) => {
      const func = (evs: IExtendedDatabaseChange[]) => {
        if (
          evs.find(
            ({ table, source }) =>
              source === 'inDbChanges' && tables.includes(table),
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

  channel$() {
    return new Observable<IExtendedDatabaseChange[]>((subscriber) => {
      const func = (evs: IExtendedDatabaseChange[]) => subscriber.next(evs);

      this.dbEventsChannel.addEventListener('message', func);

      return () => this.dbEventsChannel.removeEventListener('message', func);
    });
  }
}
