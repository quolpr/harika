import dayjs from 'dayjs';
import Q from 'sql-bricks';
import { injectable } from 'inversify';
import { BaseSyncRepository } from '../../../../extensions/SyncExtension/persistence/BaseSyncRepository';
import { ISyncCtx } from '../../../../extensions/SyncExtension/persistence/syncCtx';
import { IDatabaseChange } from '../../../../extensions/SyncExtension/synchronizer/types';
import { NotesChangesApplier } from '../sync/NotesChangesApplier';

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

@injectable()
export class NotesRepository extends BaseSyncRepository<NoteDoc, NoteRow> {
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

  changesApplier() {
    return new NotesChangesApplier();
  }
}
