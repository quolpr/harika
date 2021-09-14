import type { ISyncCtx } from '../../db/ctx';
import Q from 'sql-bricks';
import { BaseSyncRepository } from '../../db-sync/persistence/BaseSyncRepository';
import type { IDatabaseChange } from '../../db-sync/synchronizer/types';

export type NoteBlockRow = {
  id: string;
  noteId: string;
  noteBlockIds: string;
  linkedNoteIds: string;
  content: string;
  createdAt: number;
  updatedAt: number | null;
};
export type NoteBlockDocType = {
  id: string;
  noteId: string;

  noteBlockIds: string[];
  linkedNoteIds: string[];

  content: string;
  createdAt: number;
  updatedAt: number;
};

export const noteBlocksTable = 'noteBlocks' as const;
export const notesFTSTable = 'notesFTS' as const;
export const noteBlocksNotesTable = 'noteBlocksNotes' as const;
export const noteBlocksFTSTable = 'noteBlocksFTS' as const;

export type INoteBlockChangeEvent = IDatabaseChange<
  typeof noteBlocksTable,
  NoteBlockDocType
>;

export class SqlNotesBlocksRepository extends BaseSyncRepository<
  NoteBlockDocType,
  NoteBlockRow
> {
  bulkCreate(attrsArray: NoteBlockDocType[], ctx: ISyncCtx) {
    return this.db.transaction(
      () => {
        const res = super.bulkCreate(attrsArray, ctx);

        this.db.insertRecords(
          noteBlocksFTSTable,
          res.map((row) => ({
            id: row.id,
            textContent: row.content.toLowerCase(),
          })),
        );

        return res;
      },
      { ...ctx, windowId: this.windowId },
    );
  }

  bulkUpdate(records: NoteBlockDocType[], ctx: ISyncCtx) {
    return this.db.transaction(
      () => {
        const res = super.bulkUpdate(records, ctx);

        this.db.execQuery(
          Q.deleteFrom(noteBlocksFTSTable).where(
            Q.in(
              'id',
              res.map(({ id }) => id),
            ),
          ),
        );

        this.db.insertRecords(
          noteBlocksFTSTable,
          res.map((row) => ({
            id: row.id,
            textContent: row.content.toLowerCase(),
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

        this.db.execQuery(
          Q.deleteFrom(noteBlocksFTSTable).where(Q.in('id', ids)),
        );

        return res;
      },
      { ...ctx, windowId: this.windowId },
    );
  }

  getByNoteIds(ids: string[]) {
    const res = this.db.getRecords<NoteBlockRow>(
      Q.select().from(this.getTableName()).where(Q.in('noteId', ids)),
    );

    return res?.map((res) => this.toDoc(res)) || [];
  }

  getIdsByNoteId(id: string) {
    const [res] = this.db.execQuery(
      Q.select('id').from(this.getTableName()).where(Q.in('noteId', id)),
    );

    return res?.values?.map(([val]) => val as string) || [];
  }

  getByNoteId(id: string): NoteBlockDocType[] {
    return this.getByNoteIds([id]);
  }

  getTableName() {
    return noteBlocksTable;
  }

  getLinkedBlocksOfNoteId(id: string): NoteBlockDocType[] {
    return (
      this.db
        .getRecords<NoteBlockRow>(
          Q.select(`joined.*`)
            .from(noteBlocksNotesTable)
            .leftJoin(`${this.getTableName()} joined`, {
              [`${noteBlocksNotesTable}.noteBlockId`]: `joined.id`,
            })
            .where({ [`${noteBlocksNotesTable}.noteId`]: id }),
        )
        ?.map((res) => this.toDoc(res)) || []
    );
  }

  getLinksOfNoteId(id: string): Record<string, string[]> {
    const res = this.db.getRecords<{ noteId: string; noteBlockId: string }>(
      Q.select()
        .distinct('joined.noteId noteId, joined.id noteBlockId')
        .from(noteBlocksNotesTable)
        .leftJoin(`${this.getTableName()} joined`, {
          [`${noteBlocksNotesTable}.noteBlockId`]: `joined.id`,
        })
        .where({ [`${noteBlocksNotesTable}.noteId`]: id }),
    );

    const grouped: Record<string, string[]> = {};

    res.forEach(({ noteId, noteBlockId }) => {
      grouped[noteId] ||= [];
      grouped[noteId].push(noteBlockId);
    });

    return grouped;
  }

  toRow(doc: NoteBlockDocType): NoteBlockRow {
    const res = {
      ...super.toRow(doc),
      noteBlockIds: JSON.stringify(doc.noteBlockIds),
      linkedNoteIds: JSON.stringify(doc.linkedNoteIds),
    };

    return res;
  }

  toDoc(row: NoteBlockRow): NoteBlockDocType {
    const res = {
      ...super.toDoc(row),
      noteBlockIds: JSON.parse(row['noteBlockIds'] as string),
      linkedNoteIds: JSON.parse(row['linkedNoteIds'] as string),
    };

    return res;
  }
}
