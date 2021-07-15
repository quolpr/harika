import { Dexie, liveQuery } from 'dexie';
import { v4 } from 'uuid';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { isEqual } from 'lodash-es';

// table _syncStatus
export interface ISyncStatus {
  id: 1;
  lastReceivedRemoteRevision: number | null;
  lastAppliedRemoteRevision: number | null;
  clientId: string;
}

export class SyncStatusService {
  syncStatusSubject!: BehaviorSubject<ISyncStatus>;
  tableName = '_syncStatus';
  table: Dexie.Table<ISyncStatus>;

  constructor(private db: Dexie) {
    this.table = db.table(this.tableName);
  }

  async initialize() {
    this.syncStatusSubject = new BehaviorSubject(
      await this.db.transaction('rw', '_syncStatus', async () => {
        let currentStatus = await this.table.get(1);

        if (!currentStatus) {
          console.log('Creating new currentStatus');
          currentStatus = {
            id: 1,
            lastReceivedRemoteRevision: null,
            lastAppliedRemoteRevision: null,
            clientId: v4(),
          };

          this.table.put(currentStatus);
        }
        console.log('currentStatus', currentStatus);

        return currentStatus;
      }),
    );

    from(liveQuery(() => this.table.get(1)) as Observable<ISyncStatus>)
      .pipe(filter((val) => val && !isEqual(val, this.syncStatusSubject.value)))
      .subscribe((newStatus) => {
        this.syncStatusSubject.next(newStatus);
        console.log('new status!', newStatus);
      });
  }

  get value() {
    return this.syncStatusSubject.value;
  }

  async update(data: Partial<ISyncStatus>) {
    this.table.update(1, data);
  }
}
