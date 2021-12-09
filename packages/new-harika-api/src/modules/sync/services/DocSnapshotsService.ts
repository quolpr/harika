import { Knex } from 'knex';
import { snapshotsTable } from '../dbTypes';
import { IDocSnapshot } from '../types';
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
      .into(snapshotsTable);
  }
}

export type IDocSnapshotsService = NonConstructor<DocSnapshotsService>;
