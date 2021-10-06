import Q from 'sql-bricks';
import { BaseSyncRepository } from '../../../../extensions/SyncExtension/persistence/BaseSyncRepository';
import type { ISyncCtx } from '../../../../extensions/SyncExtension/persistence/syncCtx';
import type { IDatabaseChange } from '../../../../extensions/SyncExtension/synchronizer/types';

export type NoteBlockRow = {
  id: string;
  noteId: string;
  noteBlockIds: string;
  linkedNoteIds: string;
  linkedBlockIds: string;
  content: string;
  createdAt: number;
  updatedAt: number | null;
};
export type NoteBlockDoc = {
  id: string;
  noteId: string;

  noteBlockIds: string[];
  linkedNoteIds: string[];
  linkedBlockIds: string[];

  content: string;
  createdAt: number;
  updatedAt: number;
};

export const noteBlocksTable = 'noteBlocks' as const;
export const notesFTSTable = 'notesFTS' as const;
export const noteBlocksNotesTable = 'noteBlocksNotes' as const;
export const noteBlocksBlocksTable = 'noteBlocksBlocks' as const;
export const noteBlocksFTSTable = 'noteBlocksFTS' as const;

export type INoteBlockChangeEvent = IDatabaseChange<
  typeof noteBlocksTable,
  NoteBlockDoc
>;

export class NotesBlocksRepository extends BaseSyncRepository<
  NoteBlockDoc,
  NoteBlockRow
> {
  bulkCreate(attrsArray: NoteBlockDoc[], ctx: ISyncCtx) {
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

  bulkUpdate(records: NoteBlockDoc[], ctx: ISyncCtx) {
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

  getNoteIdByBlockId(blockId: string) {
    const [res] = this.db.execQuery(
      Q.select('noteId').from(this.getTableName()).where(Q.in('id', blockId)),
    );

    return res?.values?.[0]?.[0] as string | undefined;
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

  getByNoteId(id: string): NoteBlockDoc[] {
    return this.getByNoteIds([id]);
  }

  getTableName() {
    return noteBlocksTable;
  }

  getLinkedBlocksOfNoteId(id: string): NoteBlockDoc[] {
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

  getLinkedBlocksOfBlocksOfNote(
    noteId: string,
  ): Record<string, { noteId: string; blockId: string }[]> {
    const result = this.db.getRecords<{
      linkedToBlockId: string;
      noteId: string;
      blockId: string;
    }>(
      Q.select(
        '*',
        Q.select('noteId')
          .as('noteId')
          .from(noteBlocksTable)
          .where(
            Q.eq(
              `${noteBlocksBlocksTable}.blockId`,
              Q(`${noteBlocksTable}.id`),
            ),
          ),
      )
        .distinct('noteId, blockId, linkedToBlockId')
        .from(noteBlocksBlocksTable)
        .where(
          Q.in(
            'linkedToBlockId',
            Q.select('id').from(noteBlocksTable).where({ noteId }),
          ),
        ),
    );

    const obj: Record<string, { noteId: string; blockId: string }[]> = {};

    result.forEach((res) => {
      const toPush = { blockId: res.blockId, noteId: res.noteId };

      if (obj[res.linkedToBlockId] !== undefined) {
        obj[res.linkedToBlockId].push(toPush);
      } else {
        obj[res.linkedToBlockId] = [toPush];
      }
    });

    return obj;
  }

  toRow(doc: NoteBlockDoc): NoteBlockRow {
    const res = {
      ...super.toRow(doc),
      noteBlockIds: JSON.stringify(doc.noteBlockIds),
      linkedNoteIds: JSON.stringify(doc.linkedNoteIds),
      linkedBlockIds: JSON.stringify(doc.linkedBlockIds),
    };

    return res;
  }

  toDoc(row: NoteBlockRow): NoteBlockDoc {
    const res = {
      ...super.toDoc(row),
      noteBlockIds: JSON.parse(row['noteBlockIds'] as string),
      linkedNoteIds: JSON.parse(row['linkedNoteIds'] as string),
      linkedBlockIds: JSON.parse(row['linkedBlockIds'] as string),
    };

    return res;
  }
}
