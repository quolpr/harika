import {
  DatabaseChangeType,
  ICreateChange,
  IDeleteChange,
  IUpdateChange,
  NoteBlockDocType,
} from '@harika/common';
import { cloneDeep } from 'lodash';
import { difference, set, uniq } from 'lodash-es';
import { BaseConflictResolver } from './BaseConflictResolver';

export class NoteblocksChangesConflictResolver extends BaseConflictResolver<
  'noteBlocks',
  NoteBlockDocType
> {
  resolveUpdateUpdate(
    change1: IUpdateChange<'noteBlocks', NoteBlockDocType>,
    change2: IUpdateChange<'noteBlocks', NoteBlockDocType>,
  ): IUpdateChange<'noteBlocks', NoteBlockDocType> {
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

    finalMods = {
      ...finalMods,
      ...(linkedNoteIds === undefined ? {} : { linkedNoteIds }),
      ...(noteBlockIds === undefined ? {} : { noteBlockIds }),
      ...this.resolveContent(change1.to.content, change2.to.content),
    };

    return { ...change2, to: finalMods };
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
    change1: IUpdateChange<'noteBlocks', NoteBlockDocType>,
    change2: IDeleteChange<'noteBlocks', NoteBlockDocType>,
  ): ICreateChange<'noteBlocks', NoteBlockDocType> {
    const obj = cloneDeep(change2.obj);

    Object.entries(change1.to).forEach(function ([keyPath, val]) {
      set(obj, keyPath, val);
    });

    return {
      table: 'noteBlocks',
      type: DatabaseChangeType.Create,
      key: change1.key,
      source: change2.source,
      obj: obj,
    };
  }
}
