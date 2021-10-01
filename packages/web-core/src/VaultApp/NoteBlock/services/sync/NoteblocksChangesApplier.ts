import { difference, set, uniq, cloneDeep } from 'lodash-es';
import { BaseChangesApplier } from '../../../services/sync/VaultChangesApplier/BaseChangesApplier';
import { v4 } from 'uuid';
import type { NoteBlockDoc } from '../../repositories/NotesBlocksRepository';
import { noteBlocksTable } from '../../repositories/NotesBlocksRepository';
import { DatabaseChangeType } from '../../../../db/sync/synchronizer/types';
import type {
  ICreateChange,
  IDeleteChange,
  IUpdateChange,
} from '../../../../db/sync/synchronizer/types';

export class NoteblocksChangesApplier extends BaseChangesApplier<
  typeof noteBlocksTable,
  NoteBlockDoc
> {
  constructor(private idGenerator: () => string = v4) {
    super();
  }

  resolveUpdateUpdate(
    change1: IUpdateChange<typeof noteBlocksTable, NoteBlockDoc>,
    change2: IUpdateChange<typeof noteBlocksTable, NoteBlockDoc>,
  ): IUpdateChange<typeof noteBlocksTable, NoteBlockDoc> {
    let finalMods = {};

    const noteBlockIds = this.resolveIds(
      change1.from.noteBlockIds || change2.from.noteBlockIds,
      change1.to.noteBlockIds,
      change2.to.noteBlockIds,
    );

    const linkedNoteIds = this.resolveIds(
      change1.from.linkedNoteIds || change2.from.linkedNoteIds,
      change1.to.linkedNoteIds,
      change2.to.linkedNoteIds,
    );

    const linkedBlockIds = this.resolveIds(
      change1.from.linkedBlockIds || change2.from.linkedBlockIds,
      change1.to.linkedBlockIds,
      change2.to.linkedBlockIds,
    );

    finalMods = {
      ...finalMods,
      ...(linkedNoteIds === undefined ? {} : { linkedNoteIds }),
      ...(noteBlockIds === undefined ? {} : { noteBlockIds }),
      ...(linkedBlockIds === undefined ? {} : { linkedBlockIds }),
      ...this.resolveContent(change1.to.content, change2.to.content),
    };

    return { ...change2, to: finalMods, id: this.idGenerator() };
  }

  private resolveContent(
    content1: string | undefined,
    content2: string | undefined,
  ) {
    if (content1 === undefined && content2 === undefined) return {};
    if (content1 === undefined) return { content: content2 };
    if (content2 === undefined) return { content: content1 };

    return { content: `${content1}\n===\n${content2}` };
  }

  private resolveIds(
    startIds: string[] | undefined,
    ids1: string[] | undefined,
    ids2: string[] | undefined,
  ) {
    if (startIds === undefined) return;
    if (ids1 === undefined && ids2 === undefined) return;
    if (ids1 === undefined) return ids2;
    if (ids2 === undefined) return ids1;

    const removedIds = difference(startIds, ids1);
    removedIds.push(...difference(startIds, ids2));

    return uniq(ids1.concat(ids2).filter((id) => !removedIds.includes(id)));
  }

  resolveUpdateDelete(
    change1: IUpdateChange<typeof noteBlocksTable, NoteBlockDoc>,
    change2: IDeleteChange<typeof noteBlocksTable, NoteBlockDoc>,
  ): ICreateChange<typeof noteBlocksTable, NoteBlockDoc> {
    const obj = cloneDeep(change2.obj);

    Object.entries(change1.to).forEach(function ([keyPath, val]) {
      set(obj, keyPath, val);
    });

    return {
      id: this.idGenerator(),
      table: noteBlocksTable,
      type: DatabaseChangeType.Create,
      key: change1.key,
      obj: obj,
    };
  }
}
