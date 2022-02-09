import { IDocChange } from '@harika/sync-common';
import dayjs from 'dayjs';
import { injectable } from 'inversify';
import Q from 'sql-bricks';

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
  bulkCreate(
    attrsArray: NoteBlockDoc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
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

  bulkUpdate(
    records: NoteBlockDoc[],
    ctx: ISyncCtx,
    e: IQueryExecuter = this.db,
  ) {
    return e.transaction(async (t) => {
      const res = await super.bulkUpdate(records, ctx, t);

      if (res.touchedRecords.length > 0) {
        await t.execQuery(
          Q.deleteFrom(noteBlocksFTSTable).where(
            Q.in(
              'id',
              res.touchedRecords.map(({ id }) => id),
            ),
          ),
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

  bulkDelete(ids: string[], ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return e.transaction(async () => {
      const res = await super.bulkDelete(ids, ctx, e);

      await e.execQuery(
        Q.deleteFrom(noteBlocksFTSTable).where(Q.in('id', ids)),
      );

      return res;
    });
  }

  // TODO: move to getBy
  async getByTitles(
    titles: string[],
    e: IQueryExecuter = this.db,
  ): Promise<NoteBlockDoc[]> {
    return (
      await e.getRecords<NoteBlockRow>(
        Q.select().from(this.getTableName()).where(Q.in('title', titles)),
      )
    ).map((row) => this.toDoc(row));
  }

  async findInTitle(title: string, e: IQueryExecuter): Promise<NoteBlockDoc[]> {
    return (
      await e.getRecords<NoteBlockRow>(
        Q.select()
          .from(this.getTableName())
          .where(Q.like('title', `%${title}%`)),
      )
    ).map((row) => this.toDoc(row));
  }

  getTuplesWithoutDailyNotes(e: IQueryExecuter = this.db) {
    return e.getRecords<{ id: string; title: string }>(
      Q.select('id, title')
        .from(this.getTableName())
        .where(Q.eq('dailyNoteDate', null)),
    );
  }

  async getIsExistsByTitle(
    title: string,
    e: IQueryExecuter = this.db,
  ): Promise<boolean> {
    return (await this.findBy({ title }, e)) !== undefined;
  }

  async getNoteIdByBlockId(blockId: string, e: IQueryExecuter = this.db) {
    return undefined;
  }

  async getLinkedBlocks(noteId: string): Promise<
    // Key is noteId, values are block ids
    Record<string, string[]>
  > {
    return {};
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
