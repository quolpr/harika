import { IDocSnapshot } from '@harika/sync-common';
import { Knex } from 'knex';
import { groupBy } from 'lodash';

import { snapshotsTable } from '../dbTypes';
import { getSnapshotKey, NonConstructor } from '../utils';

export class DocSnapshotsService {
  async getSnapshot(
    trx: Knex,
    schemaName: string,
    collectionName: string,
    docId: string
  ): Promise<IDocSnapshot | undefined> {
    return (
      await trx
        .withSchema(schemaName)
        .from(snapshotsTable)
        .where('collectionName', collectionName)
        .andWhere('docId', docId)
        .limit(1)
    )[0];
  }

  async getSnapshots(
    trx: Knex,
    schemaName: string,
    keys: { collectionName: string; docId: string }[]
  ): Promise<IDocSnapshot[]> {
    let q = trx.withSchema(schemaName).from(snapshotsTable);

    for (const { collectionName, docId } of keys) {
      q = q.orWhere({ collectionName, docId });
    }

    return await q;
  }
  async getSnapshotsGrouped(
    trx: Knex,
    schemaName: string,
    keys: { collectionName: string; docId: string }[]
  ) {
    const res = await this.getSnapshots(trx, schemaName, keys);

    return groupBy(res, (sn) => getSnapshotKey(sn));
  }

  async insertSnapshots(
    trx: Knex,
    schemaName: string,
    snapshots: IDocSnapshot[]
  ) {
    return await trx
      .insert(snapshots)
      .withSchema(schemaName)
      .into(snapshotsTable)
      .onConflict(['collectionName', 'docId'])
      .merge();
  }

  async getStatus(
    trx: Knex,
    schemaName: string
  ): Promise<{
    currentRev: number;
    lastTimestamp: string | undefined;
  }> {
    const [[currentRev], [lastTimestamp]] = await Promise.all([
      trx.from(snapshotsTable).withSchema(schemaName).max('rev'),
      trx.from(snapshotsTable).withSchema(schemaName).max('lastTimestamp'),
    ]);

    return {
      currentRev:
        currentRev['max'] !== null
          ? parseInt(currentRev['max'], 10)
          : undefined,
      lastTimestamp: ((lastTimestamp as any).max as string) || undefined,
    };
  }

  async getSnapshotsFromRev(
    trx: Knex,
    schemaName: string,
    rev: number
  ): Promise<IDocSnapshot[]> {
    return await trx
      .withSchema(schemaName)
      .from(snapshotsTable)
      .where('rev', '>', rev);
  }
}

export type IDocSnapshotsService = NonConstructor<DocSnapshotsService>;
