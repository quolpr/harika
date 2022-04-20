import sql, { join, raw } from 'sql-template-tag';

import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { BaseBlockDoc, BaseBlockRow } from './AllBlocksRepository';
import { BaseBlockRepository } from './BaseBlockRepository';

export const textBlocksTable = 'textBlocks' as const;
export const textBlocksFTSTable = 'textBlocksFTS' as const;

export type TextBlockRow = BaseBlockRow & {
  content: string;
  type: 'textBlock';
};

export type TextBlockDoc = BaseBlockDoc & {
  content: string;
  type: 'textBlock';
};

export class TextBlocksRepository extends BaseBlockRepository<
  TextBlockDoc,
  TextBlockRow
> {
  async bulkCreate(
    attrsArray: TextBlockDoc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    if (attrsArray.length === 0) return [];

    return e.transaction(async (t) => {
      const res = await super.bulkCreate(attrsArray, ctx, t);

      await t.insertRecords(
        textBlocksFTSTable,
        res.map((row) => ({
          id: row.id,
          textContent: row.content.toLowerCase(),
        })),
      );

      return res;
    });
  }

  async bulkUpdate(
    records: TextBlockDoc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    if (records.length === 0) return { records: [], touchedRecords: [] };
    return e.transaction(async (t) => {
      const res = await super.bulkUpdate(records, ctx, t);

      if (res.touchedRecords.length > 0) {
        await t.execQuery(
          sql`DELETE FROM ${raw(textBlocksFTSTable)} WHERE id IN (${join(
            res.touchedRecords.map(({ id }) => id),
          )})`,
        );

        await t.insertRecords(
          textBlocksFTSTable,
          res.touchedRecords.map((row) => ({
            id: row.id,
            textContent: row.content.toLowerCase(),
          })),
        );
      }

      return res;
    });
  }

  async bulkDelete(ids: string[], ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    if (ids.length === 0) return;

    return e.transaction(async (t) => {
      const res = await super.bulkDelete(ids, ctx, t);

      await t.execQuery(
        sql`DELETE FROM ${raw(textBlocksFTSTable)} WHERE id IN (${join(ids)})`,
      );

      return res;
    });
  }

  getTableName() {
    return textBlocksTable;
  }

  get docType() {
    return 'textBlock';
  }
}
