import { Knex } from 'knex';
import { IAnyDoc, IDocSnapshot } from '../types';

export class DocSnapshotsService {
  async getSnapshot(
    trx: Knex,
    collectionName: string,
    docId: string
  ): Promise<IDocSnapshot> {}
}
