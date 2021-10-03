import dayjs from 'dayjs';
import Q from 'sql-bricks';
import { BaseSyncRepository } from '../../../../lib/db/sync/persistence/BaseSyncRepository';
import type { ISyncCtx } from '../../../../lib/db/sync/persistence/syncCtx';
import type { IDatabaseChange } from '../../../../lib/db/sync/synchronizer/types';
import { notesFTSTable } from '../../NoteBlocksApp/repositories/NotesBlocksRepository';

export type NoteRow = {
  id: string;
  title: string;
  dailyNoteDate: number | null;
  createdAt: number;
  updatedAt: number | null;
  rootBlockId: string;
};
export const notesTable = 'notes' as const;
export type NoteDoc = {
  id: string;
  title: string;
  dailyNoteDate: number | null;
  createdAt: number;
  updatedAt: number;
  rootBlockId: string;
};

export type INoteChangeEvent = IDatabaseChange<typeof notesTable, NoteDoc>;

export class SqlNotesRepository extends BaseSyncRepository<NoteDoc, NoteRow> {
  bulkCreate(attrsArray: NoteDoc[], ctx: ISyncCtx) {
    return this.db.transaction(
      () => {
        const res = super.bulkCreate(attrsArray, ctx);

        this.db.insertRecords(
          notesFTSTable,
          res.map((row) => ({
            id: row.id,
            title: row.title.toLowerCase(),
          })),
        );

        return res;
      },
      { ...ctx, windowId: this.windowId },
    );
  }

  bulkUpdate(records: NoteDoc[], ctx: ISyncCtx) {
    return this.db.transaction(
      () => {
        const res = super.bulkUpdate(records, ctx);

        this.db.execQuery(
          Q.deleteFrom(notesFTSTable).where(
            Q.in(
              'id',
              res.map(({ id }) => id),
            ),
          ),
        );

        this.db.insertRecords(
          notesFTSTable,
          res.map((row) => ({
            id: row.id,
            title: row.title.toLowerCase(),
          })),
        );

        return res;
      },
      { ...ctx, windowId: this.windowId },
    );
  }

  bulkDelete(ids: string[], ctx: ISyncCtx) {
    return this.db.transaction(
      () => {
        const res = super.bulkDelete(ids, ctx);

        this.db.execQuery(Q.deleteFrom(notesFTSTable).where(Q.in('id', ids)));

        return res;
      },
      { ...ctx, windowId: this.windowId },
    );
  }
  // TODO: move to getBy
  getByTitles(titles: string[]): NoteDoc[] {
    return this.db
      .getRecords<NoteDoc>(
        Q.select().from(this.getTableName()).where(Q.in('title', titles)),
      )
      .map((row) => this.toDoc(row));
  }

  findInTitle(title: string): NoteDoc[] {
    return this.db
      .getRecords<NoteDoc>(
        Q.select()
          .from(this.getTableName())
          .where(Q.like('title', `%${title}%`)),
      )
      .map((row) => this.toDoc(row));
  }

  getTuplesWithoutDailyNotes() {
    return this.db.getRecords<{ id: string; title: string }>(
      Q.select('id, title')
        .from(this.getTableName())
        .where(Q.eq('dailyNoteDate', null)),
    );
  }

  getIsExistsByTitle(title: string): boolean {
    return this.findBy({ title }) !== undefined;
  }

  getDailyNote(date: number) {
    const startOfDate = dayjs.unix(date).startOf('day');

    return this.findBy({ dailyNoteDate: startOfDate.unix() * 1000 });
  }

  getTableName() {
    return notesTable;
  }
}
