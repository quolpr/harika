import Q from 'sql-bricks';
import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { BaseBlockDoc, BaseBlockRow } from './AllBlocksRepository';
import { BaseBlockRepository } from './BaseBlockRepository';

export const textBlocksTable = 'textBlocks' as const;
export const textBlocksFTSTable = 'textBlocksFTS' as const;

export type NoteBlockRow = BaseBlockRow & {
  content: string;
};

export type NoteBlockDoc = BaseBlockDoc & {
  content: string;
};

export class TextBlocksRepository extends BaseBlockRepository<
  NoteBlockDoc,
  NoteBlockRow
> {
  bulkCreate(
    attrsArray: NoteBlockDoc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
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

  bulkUpdate(
    records: NoteBlockDoc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    return e.transaction(async (t) => {
      const res = await super.bulkUpdate(records, ctx, t);

      if (res.touchedRecords.length > 0) {
        await t.execQuery(
          Q.deleteFrom(textBlocksFTSTable).where(
            Q.in(
              'id',
              res.touchedRecords.map(({ id }) => id),
            ),
          ),
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

  bulkDelete(ids: string[], ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return e.transaction(async (t) => {
      const res = await super.bulkDelete(ids, ctx, t);

      await t.execQuery(
        Q.deleteFrom(textBlocksFTSTable).where(Q.in('id', ids)),
      );

      return res;
    });
  }

  getTableName() {
    return textBlocksTable;
  }
}
