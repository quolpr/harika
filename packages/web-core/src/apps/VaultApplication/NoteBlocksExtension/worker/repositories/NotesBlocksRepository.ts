import Q from 'sql-bricks';
import { BaseSyncRepository } from '../../../../../extensions/SyncExtension/worker/BaseSyncRepository';
import type { ISyncCtx } from '../../../../../extensions/SyncExtension/worker/syncCtx';
import type { IDatabaseChange } from '../../../../../extensions/SyncExtension/app/serverSynchronizer/types';
import { NoteblocksChangesApplier } from '../sync/NoteblocksChangesApplier';
import { IQueryExecuter } from '../../../../../extensions/DbExtension/DB';

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

      await t.execQuery(
        Q.deleteFrom(noteBlocksFTSTable).where(
          Q.in(
            'id',
            res.map(({ id }) => id),
          ),
        ),
      );

      await t.insertRecords(
        noteBlocksFTSTable,
        res.map((row) => ({
          id: row.id,
          textContent: row.content.toLowerCase(),
        })),
      );

      return res;
    });
  }

  bulkDelete(ids: string[], ctx: ISyncCtx, e: IQueryExecuter = this.db) {
    return e.transaction(async (t) => {
      const res = await super.bulkDelete(ids, ctx, t);

      await t.execQuery(
        Q.deleteFrom(noteBlocksFTSTable).where(Q.in('id', ids)),
      );

      return res;
    });
  }

  async getNoteIdByBlockId(blockId: string, e: IQueryExecuter = this.db) {
    const [res] = await e.execQuery(
      Q.select('noteId').from(this.getTableName()).where(Q.in('id', blockId)),
    );

    return res?.values?.[0]?.[0] as string | undefined;
  }

  async getByNoteIds(ids: string[], e: IQueryExecuter = this.db) {
    const res = await e.getRecords<NoteBlockRow>(
      Q.select().from(this.getTableName()).where(Q.in('noteId', ids)),
    );

    return res?.map((res) => this.toDoc(res)) || [];
  }

  async getIdsByNoteId(id: string, e: IQueryExecuter) {
    const [res] = await e.execQuery(
      Q.select('id').from(this.getTableName()).where(Q.in('noteId', id)),
    );

    return res?.values?.map(([val]) => val as string) || [];
  }

  async getByNoteId(id: string, e: IQueryExecuter): Promise<NoteBlockDoc[]> {
    return this.getByNoteIds([id], e);
  }

  getTableName() {
    return noteBlocksTable;
  }

  async getLinkedBlocksOfNoteId(
    id: string,
    e: IQueryExecuter,
  ): Promise<NoteBlockDoc[]> {
    return (
      (
        await e.getRecords<NoteBlockRow>(
          Q.select(`joined.*`)
            .from(noteBlocksNotesTable)
            .leftJoin(`${this.getTableName()} joined`, {
              [`${noteBlocksNotesTable}.noteBlockId`]: `joined.id`,
            })
            .where({ [`${noteBlocksNotesTable}.noteId`]: id }),
        )
      )?.map((res) => this.toDoc(res)) || []
    );
  }

  async getLinksOfNoteId(
    id: string,
    e: IQueryExecuter = this.db,
  ): Promise<Record<string, string[]>> {
    const res = await e.getRecords<{ noteId: string; noteBlockId: string }>(
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

  async getLinkedBlocksOfBlocksOfNote(
    noteId: string,
    e: IQueryExecuter = this.db,
  ): Promise<Record<string, { noteId: string; blockId: string }[]>> {
    const result = await e.getRecords<{
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

  changesApplier() {
    return new NoteblocksChangesApplier();
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
