import { IDocChange } from '@harika/sync-common';
import { Knex } from 'knex';
import { IChangesService } from './changesService';
import { groupBy, minBy } from 'lodash';
import { IDocSnapshotsService } from './DocSnapshotsService';
import {
  getChangesKey,
  NonConstructor,
  parseKey,
  snapshotToCreateChange,
} from '../utils';
import { buildSnapshot } from './buildSnapshot';

export class IncomingChangesHandler {
  constructor(
    private db: Knex,
    private changesService: IChangesService,
    private docSnapshotsService: IDocSnapshotsService
  ) {}

  async handleIncomeChanges(
    schemaName: string,
    receivedFromClientId: string,
    changes: IDocChange[]
  ) {
    return await this.db.transaction(async (trx) => {
      await trx.raw(`LOCK TABLE "${schemaName}"."changes" IN EXCLUSIVE MODE`);

      const groupedChanges = groupBy(changes, (ch) => getChangesKey(ch));

      const groupedSnapshots =
        await this.docSnapshotsService.getSnapshotsGrouped(
          trx,
          schemaName,
          Object.values(groupedChanges).map((chs) => ({
            docId: chs[0].docId,
            collectionName: chs[0].collectionName,
          }))
        );

      const isAnyChangeAfterClocks =
        await this.changesService.isAnyChangeAfterClocks(
          trx,
          schemaName,
          Object.values(groupedChanges).map((chs) => {
            const minChange = minBy(chs, (ch) => ch.timestamp);

            return {
              collectionName: chs[0].collectionName,
              docId: chs[0].docId,
              afterClock: minChange.timestamp,
            };
          })
        );

      const insertedNewChanges = groupBy(
        await this.changesService.insertChanges(
          trx,
          schemaName,
          changes.map((ch) => ({ ...ch, receivedFromClientId }))
        ),
        (ch) => getChangesKey(ch)
      );

      // Only that changes will selected that requires recalculation
      // It already contains new changes(cause they were inserted before)
      const groupedChangesForRecalculation =
        await this.changesService.getGroupedChangesByKeys(
          trx,
          schemaName,
          Object.entries(isAnyChangeAfterClocks)
            .filter(([, present]) => present)
            .map(([k]) => parseKey(k))
        );

      const snapshots = Object.keys(groupedChanges).map((uniqKey) => {
        if (groupedChangesForRecalculation[uniqKey]) {
          return buildSnapshot(groupedChangesForRecalculation[uniqKey]);
        } else if (groupedSnapshots[uniqKey] === undefined) {
          return buildSnapshot(insertedNewChanges[uniqKey]);
        } else {
          return buildSnapshot([
            snapshotToCreateChange(groupedSnapshots[uniqKey][0]),
            ...insertedNewChanges[uniqKey],
          ]);
        }
      });

      await this.docSnapshotsService.insertSnapshots(
        trx,
        schemaName,
        snapshots
      );

      return snapshots;
    });
  }
}

export type IIncomingChangesHandler = NonConstructor<IncomingChangesHandler>;
