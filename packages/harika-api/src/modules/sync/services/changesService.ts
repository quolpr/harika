import { IDocChange, IDocChangeWithRev, WithRev } from '@harika/sync-common';
import { Knex } from 'knex';
import { groupBy } from 'lodash';

import { docChangesTable } from '../dbTypes';
import { getChangesKey, getUniqKey, NonConstructor } from '../utils';

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

  async getGroupedChangesByKeys(
    trx: Knex,
    schemaName: string,
    keys: { collectionName: string; docId: string }[]
  ) {
    if (keys.length === 0) return {};

    let q = trx
      .select()
      .withSchema(schemaName)
      .from(docChangesTable)
      .orderBy('timestamp');

    q.andWhere((b1) => {
      for (const { collectionName, docId } of keys) {
        b1.orWhere((b2) => {
          return b2.where({ collectionName, docId });
        });
      }
    });

    return groupBy((await q) as WithRev<IDocChange>[], (ch) =>
      getChangesKey(ch)
    );
  }

  async isAnyChangeAfterClocks(
    trx: Knex,
    schemaName: string,
    keys: {
      collectionName: string;
      docId: string;
      afterClock: string;
    }[]
  ) {
    let q = trx
      .select('collectionName', 'docId')
      .withSchema(schemaName)
      .from(docChangesTable)
      .groupBy('collectionName', 'docId');

    q.andWhere((b1) => {
      for (const { collectionName, docId, afterClock } of keys) {
        b1.orWhere((b2) => {
          return b2
            .where({ collectionName, docId })
            .where('timestamp', '>=', afterClock);
        });
      }
    });

    const resultTable = Object.fromEntries(
      ((await q) as Array<{ collectionName: string; docId: string }>).map(
        ({ collectionName, docId }) =>
          [getUniqKey({ collectionName, docId }), docId] as const
      )
    );

    return Object.fromEntries(
      keys.map(
        (data) =>
          [getUniqKey(data), Boolean(resultTable[getUniqKey(data)])] as const
      )
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
      .andWhere('docId', entityId)
      .orderBy('timestamp');
  }

  async insertChanges(
    trx: Knex,
    schemaName: string,
    chs: IDocChange[]
  ): Promise<IDocChangeWithRev[]> {
    const insertResult = await trx
      .insert(chs, ['id', 'rev'])
      .withSchema(schemaName)
      .into(docChangesTable)
      .onConflict('id')
      .ignore();

    const idRevMap = Object.fromEntries(
      insertResult.map(({ id, rev }) => [id, rev])
    );

    return chs.map((ch) => ({ ...ch, rev: idRevMap[ch.id] }));
  }
}

export type IChangesService = NonConstructor<ChangesService>;
