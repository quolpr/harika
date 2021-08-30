import { DatabaseChangeType } from '../../../dexieTypes';
import type { NoteBlockDocType } from '../../../dexieTypes';
import type {
  ICreateChange,
  IDeleteChange,
  IUpdateChange,
} from '../../../dexieTypes';
import { difference, set, uniq, cloneDeep } from 'lodash-es';
import { BaseChangesApplier } from './BaseChangesApplier';
import { v4 } from 'uuid';

export class NoteblocksChangesApplier extends BaseChangesApplier<
  'noteBlocks',
  NoteBlockDocType
> {
  constructor(private idGenerator: () => string = v4) {
    super();
  }

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
    change1: IUpdateChange<'noteBlocks', NoteBlockDocType>,
    change2: IDeleteChange<'noteBlocks', NoteBlockDocType>,
  ): ICreateChange<'noteBlocks', NoteBlockDocType> {
    const obj = cloneDeep(change2.obj);

    Object.entries(change1.to).forEach(function ([keyPath, val]) {
      set(obj, keyPath, val);
    });

    return {
      id: this.idGenerator(),
      table: 'noteBlocks',
      type: DatabaseChangeType.Create,
      key: change1.key,
      obj: obj,
    };
  }
}
