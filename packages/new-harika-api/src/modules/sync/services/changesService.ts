import { Knex } from 'knex';
import { docChangesTable } from '../dbTypes';
import { IDocChange, IDocChangeWithRev } from '../types';
import { NonConstructor } from '../utils';

export class ChangesService {
  async isAnyChangeAfterClock(
    trx: Knex,
    schemaName: string,
    collectionName: string,
    docId: string,
    afterClock: string,
    excludeIds: string[]
  ) {
    return (
      (
        await trx
          .select('id')
          .withSchema(schemaName)
          .from(docChangesTable)
          .where('timestamp', '>=', afterClock)
          .andWhere('collectionName', collectionName)
          .andWhere('docId', docId)
          .whereNotIn('id', excludeIds)
          .limit(1)
      ).length > 0
    );
  }

  async getAllChanges(
    trx: Knex,
    schemaName: string,
    collectionName: string,
    entityId: string
  ): Promise<IDocChangeWithRev[]> {
    return await trx
      .withSchema(schemaName)
      .from(docChangesTable)
      .andWhere('collectionName', collectionName)
      .andWhere('docId', entityId);
  }

  async insertChanges(
    trx: Knex,
    schemaName: string,
    chs: IDocChange[]
  ): Promise<IDocChangeWithRev[]> {
    const insertResult = await trx
      .insert(chs, ['id', 'rev'])
      .withSchema(schemaName)
      .into(docChangesTable);

    const idRevMap = Object.fromEntries(
      insertResult.map(({ id, rev }) => [id, rev])
    );

    return chs.map((ch) => ({ ...ch, rev: idRevMap[ch.id] }));
  }
}

export type IChangesService = NonConstructor<ChangesService>;
