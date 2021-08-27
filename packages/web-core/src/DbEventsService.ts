import { BroadcastChannel } from 'broadcast-channel';
import { Observable, ObservableInput, switchMap } from 'rxjs';
import type { ITransmittedChange } from './SqlNotesRepository.worker';

export class DbEventsService {
  dbEventsChannel: BroadcastChannel;

  constructor(dbName: string) {
    this.dbEventsChannel = new BroadcastChannel(dbName, {
      webWorkerSupport: true,
    });
  }

  liveQuery<T extends any>(tables: string[], query: () => ObservableInput<T>) {
    return new Observable((subscriber) => {
      const func = (evs: ITransmittedChange[]) => {
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
    return new Observable<ITransmittedChange[]>((subscriber) => {
      const func = (evs: ITransmittedChange[]) => subscriber.next(evs);

      this.dbEventsChannel.addEventListener('message', func);

      return () => this.dbEventsChannel.removeEventListener('message', func);
    });
  }
}
