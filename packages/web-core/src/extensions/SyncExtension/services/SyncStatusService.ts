import { HybridClock, makeClientId } from '@harika/sync-common';
import { inject, injectable } from 'inversify';
import { DB, IQueryExecuter } from '../../DbExtension/DB';
import Q from 'sql-bricks';
import { times } from 'lodash-es';

export const syncStatusTable = 'syncStatus' as const;
export interface ISyncStatus {
  id: 1;
  lastReceivedRemoteRevision: number | null;
  lastAppliedRemoteRevision: number | null;
  clientId: string;
  currentClock: string;
}

@injectable()
export class SyncStatusService {
  constructor(@inject(DB) private db: DB) {}

  async getSyncStatus(e: IQueryExecuter = this.db): Promise<ISyncStatus> {
    let status = (
      await e.getRecords<ISyncStatus>(
        Q.select().from(syncStatusTable).where({ id: 1 }),
      )
    )[0];

    if (!status) {
      const clientId = makeClientId();

      status = {
        id: 1,
        lastReceivedRemoteRevision: null,
        lastAppliedRemoteRevision: null,
        clientId: clientId,
        currentClock: new HybridClock(0, 0, clientId).toString(),
      };

      await e.insertRecords(syncStatusTable, [status]);
    }

    return status;
  }

  updateSyncStatus(status: Partial<ISyncStatus>, e: IQueryExecuter) {
    return e.execQuery(Q.update(syncStatusTable).set(status).where({ id: 1 }));
  }

  async getCurrentClock(e: IQueryExecuter = this.db) {
    return (await this.getSyncStatus(e)).currentClock;
  }

  async getNextClockBulk(count: number, e: IQueryExecuter = this.db) {
    if (count === 0) return [];

    let currentClock = HybridClock.parse(await this.getCurrentClock(e));

    const clocksArray = times(count, () => {
      const newClock = HybridClock.send(currentClock);

      currentClock = newClock;

      return newClock.toString();
    });

    await this.updateSyncStatus({ currentClock: currentClock.toString() }, e);

    return clocksArray;
  }

  // async updateClock( newClock: string, e: IQueryExecuter = this.db,) {
  //   const currentClock = await this.getCurrentClock();

  //   const updatedClock = HybridClock.recv(
  //     HybridClock.parse(currentClock),
  //     HybridClock.parse(newClock),
  //   );

  //   await this.updateSyncStatus({ currentClock: updatedClock.toString() }, e);
  // }
}
