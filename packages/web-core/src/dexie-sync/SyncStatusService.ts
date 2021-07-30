import type { Dexie } from 'dexie';
import { v4 } from 'uuid';

// table _syncStatus
export interface ISyncStatus {
  id: 1;
  lastReceivedRemoteRevision: number | null;
  lastAppliedRemoteRevision: number | null;
  clientId: string;
}

export class SyncStatusService {
  table: Dexie.Table<ISyncStatus>;

  constructor(private db: Dexie) {
    this.table = db.table('_syncStatus');
  }

  async get() {
    return await this.db.transaction('rw', '_syncStatus', async () => {
      let currentStatus = await this.table.get(1);

      if (!currentStatus) {
        currentStatus = {
          id: 1,
          lastReceivedRemoteRevision: null,
          lastAppliedRemoteRevision: null,
          clientId: v4(),
        };

        await this.table.put(currentStatus);
      }

      return currentStatus;
    });
  }

  async update(data: Partial<ISyncStatus>) {
    this.table.update(1, data);
  }
}
