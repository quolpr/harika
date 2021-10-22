import dayjs from 'dayjs';
import Q from 'sql-bricks';
import { injectable } from 'inversify';
import { BaseSyncRepository } from '../../../../../extensions/SyncExtension/worker/BaseSyncRepository';
import { ISyncCtx } from '../../../../../extensions/SyncExtension/worker/syncCtx';
import { IDatabaseChange } from '../../../../../extensions/SyncExtension/app/serverSynchronizer/types';
import { NotesChangesApplier } from '../sync/NotesChangesApplier';
import { remotable } from '../../../../../framework/utils';
import { IQueryExecuter } from '../../../../../extensions/DbExtension/DB';

export const notesTable = 'notes' as const;
export const notesFTSTable = 'notesFts' as const;

export type NoteRow = {
  id: string;
  title: string;
  dailyNoteDate: number | null;
  createdAt: number;
  updatedAt: number | null;
};
export type NoteDoc = {
  id: string;
  title: string;
  dailyNoteDate: number | null;
  createdAt: number;
  updatedAt: number;
};

export type INoteChangeEvent = IDatabaseChange<typeof notesTable, NoteDoc>;

@remotable('NotesRepository')
@injectable()
export class NotesRepository extends BaseSyncRepository<NoteDoc, NoteRow> {
  bulkCreate(attrsArray: NoteDoc[], ctx: ISyncCtx, e: IQueryExecuter) {
    return e.transaction(async (t) => {
      const res = await super.bulkCreate(attrsArray, ctx, t);

      await t.insertRecords(
        notesFTSTable,
        res.map((row) => ({
          id: row.id,
          title: row.title.toLowerCase(),
        })),
      );

      return res;
    });
  }

  bulkUpdate(records: NoteDoc[], ctx: ISyncCtx, e: IQueryExecuter) {
    return e.transaction(async (t) => {
      const res = await super.bulkUpdate(records, ctx, t);

      await t.execQuery(
        Q.deleteFrom(notesFTSTable).where(
          Q.in(
            'id',
            res.map(({ id }) => id),
          ),
        ),
      );

      await t.insertRecords(
        notesFTSTable,
        res.map((row) => ({
          id: row.id,
          title: row.title.toLowerCase(),
        })),
      );

      return res;
    });
  }

  bulkDelete(ids: string[], ctx: ISyncCtx, e: IQueryExecuter) {
    return e.transaction(async () => {
      const res = await super.bulkDelete(ids, ctx, e);

      await e.execQuery(Q.deleteFrom(notesFTSTable).where(Q.in('id', ids)));

      return res;
    });
  }

  // TODO: move to getBy
  async getByTitles(
    titles: string[],
    e: IQueryExecuter = this.db,
  ): Promise<NoteDoc[]> {
    return (
      await e.getRecords<NoteDoc>(
        Q.select().from(this.getTableName()).where(Q.in('title', titles)),
      )
    ).map((row) => this.toDoc(row));
  }

  async findInTitle(title: string, e: IQueryExecuter): Promise<NoteDoc[]> {
    return (
      await e.getRecords<NoteDoc>(
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

  getDailyNote(date: number, e: IQueryExecuter = this.db) {
    const startOfDate = dayjs.unix(date).startOf('day');

    return this.findBy({ dailyNoteDate: startOfDate.unix() * 1000 }, e);
  }

  getTableName() {
    return notesTable;
  }

  changesApplier() {
    return new NotesChangesApplier();
  }
}
