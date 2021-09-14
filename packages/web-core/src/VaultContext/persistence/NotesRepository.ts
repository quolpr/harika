import dayjs from 'dayjs';
import Q from 'sql-bricks';
import { BaseSyncRepository } from '../../db-sync/persistence/BaseSyncRepository';
import type { ISyncCtx } from '../../db-sync/persistence/syncCtx';
import type { IDatabaseChange } from '../../db-sync/synchronizer/types';
import { notesFTSTable } from './NotesBlocksRepository';

export type NoteRow = {
  id: string;
  title: string;
  dailyNoteDate: number | null;
  createdAt: number;
  updatedAt: number | null;
  rootBlockId: string;
};
export const notesTable = 'notes' as const;
export type NoteDocType = {
  id: string;
  title: string;
  dailyNoteDate: number | null;
  createdAt: number;
  updatedAt: number;
  rootBlockId: string;
};

export type INoteChangeEvent = IDatabaseChange<typeof notesTable, NoteDocType>;

export class SqlNotesRepository extends BaseSyncRepository<
  NoteDocType,
  NoteRow
> {
  bulkCreate(attrsArray: NoteDocType[], ctx: ISyncCtx) {
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

  bulkUpdate(records: NoteDocType[], ctx: ISyncCtx) {
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
  getByTitles(titles: string[]): NoteDocType[] {
    return this.db
      .getRecords<NoteDocType>(
        Q.select().from(this.getTableName()).where(Q.in('title', titles)),
      )
      .map((row) => this.toDoc(row));
  }

  findInTitle(title: string): NoteDocType[] {
    return this.db
      .getRecords<NoteDocType>(
        Q.select()
          .from(this.getTableName())
          .where(Q.like('title', `%${title}%`)),
      )
      .map((row) => this.toDoc(row));
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
