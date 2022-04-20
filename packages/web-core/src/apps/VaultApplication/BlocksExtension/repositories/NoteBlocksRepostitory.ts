import { IDocChange } from '@harika/sync-common';
import dayjs from 'dayjs';
import { injectable } from 'inversify';
import sql, { join, raw } from 'sql-template-tag';

import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { BaseBlockDoc, BaseBlockRow } from './AllBlocksRepository';
import { BaseBlockRepository } from './BaseBlockRepository';

export const noteBlocksTable = 'noteBlocks' as const;
export const noteBlocksFTSTable = 'notesBlocksFts' as const;

export type NoteBlockRow = BaseBlockRow & {
  title: string;
  dailyNoteDate: number | null;
};

export type NoteBlockDoc = BaseBlockDoc & {
  title: string;
  dailyNoteDate: number | null;
  type: 'noteBlock';
};

export type INoteChangeEvent = IDocChange<typeof noteBlocksTable, NoteBlockDoc>;

@injectable()
export class NoteBlocksRepository extends BaseBlockRepository<
  NoteBlockDoc,
  NoteBlockRow
> {
  async bulkCreate(
    attrsArray: NoteBlockDoc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    if (attrsArray.length === 0) return [];

    return e.transaction(async (t) => {
      const res = await super.bulkCreate(attrsArray, ctx, t);

      await t.insertRecords(
        noteBlocksFTSTable,
        res.map((row) => ({
          id: row.id,
          title: row.title.toLowerCase(),
        })),
      );

      return res;
    });
  }

  async bulkUpdate(
    records: NoteBlockDoc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    if (records.length === 0) return { records: [], touchedRecords: [] };

    return e.transaction(async (t) => {
      const res = await super.bulkUpdate(records, ctx, t);

      if (res.touchedRecords.length > 0) {
        await t.execQuery(
          sql`DELETE FROM ${raw(noteBlocksFTSTable)} WHERE id IN (${join(
            res.touchedRecords.map(({ id }) => id),
          )})`,
        );

        await t.insertRecords(
          noteBlocksFTSTable,
          res.touchedRecords.map((row) => ({
            id: row.id,
            title: row.title.toLowerCase(),
          })),
        );
      }

      return res;
    });
  }

  async bulkDelete(ids: string[], ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    if (ids.length === 0) return;

    return e.transaction(async () => {
      const res = await super.bulkDelete(ids, ctx, e);

      await e.execQuery(
        sql`DELETE FROM ${raw(noteBlocksFTSTable)} WHERE id IN (${join(ids)})`,
      );

      return res;
    });
  }

  // TODO: move to getBy
  async getByTitles(
    titles: string[],
    e: IQueryExecuter = this.db,
  ): Promise<NoteBlockDoc[]> {
    if (titles.length === 0) return [];

    return (
      await e.getRecords<NoteBlockRow>(
        sql`SELECT * FROM ${raw(this.getTableName())} WHERE title IN (${join(
          titles,
        )})`,
      )
    ).map((row) => this.toDoc(row));
  }

  async findInTitle(title: string, e: IQueryExecuter): Promise<NoteBlockDoc[]> {
    return (
      await e.getRecords<NoteBlockRow>(
        sql`SELECT * FROM ${raw(this.getTableName())} WHERE title LIKE '${
          '%' + title + '%'
        }'`,
      )
    ).map((row) => this.toDoc(row));
  }

  getTuplesWithoutDailyNotes(e: IQueryExecuter = this.db) {
    return e.getRecords<{ id: string; title: string }>(
      sql`SELECT id, title FROM ${raw(
        this.getTableName(),
      )} t WHERE t.dailyNoteDate IS NULL`,
    );
  }

  async getIsExistsByTitle(
    title: string,
    e: IQueryExecuter = this.db,
  ): Promise<boolean> {
    return (await this.findBy({ title }, e)) !== undefined;
  }

  getDailyNote(date: number, e: IQueryExecuter = this.db) {
    const startOfDate = dayjs.unix(date).startOf('day');

    return this.findBy({ dailyNoteDate: startOfDate.unix() * 1000 }, e);
  }

  getTableName() {
    return noteBlocksTable;
  }

  get docType() {
    return 'noteBlock';
  }
}
