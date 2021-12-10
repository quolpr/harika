import { Knex } from 'knex';
import { snapshotsTable } from '../dbTypes';
import { IDocSnapshot } from '@harika/sync-common';
import { NonConstructor } from '../utils';

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

  async insertSnapshots(
    trx: Knex,
    schemaName: string,
    snapshots: IDocSnapshot[]
  ) {
    return await trx
      .insert(snapshots)
      .withSchema(schemaName)
      .into(snapshotsTable)
      // TODO: docId + collectionName PK
      .onConflict('docId')
      .merge();
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
