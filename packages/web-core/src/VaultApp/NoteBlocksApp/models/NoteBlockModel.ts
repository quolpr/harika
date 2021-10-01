import { createContext, ModelCreationData, Ref } from 'mobx-keystone';
import {
  customRef,
  detach,
  findParent,
  model,
  Model,
  modelAction,
  prop,
  tProp,
  types,
} from 'mobx-keystone';
import { comparer, computed } from 'mobx';
import { isEqual } from 'lodash-es';
import type { BlockContentModel } from './BlockContentModel';
import { isBlocksApp, NoteBlocksApp } from '../NoteBlocksApp';
import { syncable } from '../../utils/syncable';

export const noteBlockRef = customRef<NoteBlockModel>('harika/NoteBlockRef', {
  resolve(ref) {
    const app = findParent<NoteBlocksApp>(this, isBlocksApp);

    if (!app) {
      return undefined;
    }

    return app.getNoteBlock(ref.id);
  },

  onResolvedValueChange() {
    // don't detach ref, we will do it NoteBlockModel code
  },
});

export const rootBlockIdCtx = createContext<string>('');
export const parentBlockCtx = createContext<NoteBlockModel | undefined>();

export const blockModelType = 'harika/NoteBlockModel';

@model('harika/NoteBlockModel')
@syncable
export class NoteBlockModel extends Model({
  noteId: prop<string>(),
  content: prop<BlockContentModel>(),
  noteBlockRefs: prop<Ref<NoteBlockModel>[]>(),
  // It is important here that we are using ids instead of refs,
  // it means that this data could not be in the registry and should be preloaded from the DB
  linkedNoteIds: prop<string[]>(() => []),
  linkedBlockIds: prop<string[]>(() => []),
  createdAt: tProp(types.dateTimestamp),
  updatedAt: tProp(types.dateTimestamp),
}) {
  @computed
  get isRoot() {
    return rootBlockIdCtx.get(this) === this.$modelId;
  }

  @computed
  get parent(): NoteBlockModel | undefined {
    return parentBlockCtx.get(this);
  }

  @computed
  get hasChildren() {
    return this.noteBlockRefs.length !== 0;
  }

  @computed({ equals: comparer.shallow })
  get noteBlockIds() {
    return this.noteBlockRefs.map(({ id }) => id);
  }

  @computed
  get orderPosition() {
    return this.parent?.noteBlockRefs.findIndex((n) => n.id === this.$modelId)!;
  }

  @modelAction
  move(parent: NoteBlockModel, pos: number | 'start' | 'end') {
    if (this.isRoot) {
      throw new Error("Can't move root block");
    }

    this.parent?.noteBlockRefs.splice(this.orderPosition, 1);

    const newPos = (() => {
      if (pos === 'start') {
        return 0;
      } else if (pos === 'end') {
        return parent.noteBlockRefs.length;
      } else {
        return pos;
      }
    })();

    parent.noteBlockRefs.splice(newPos, 0, noteBlockRef(this));
  }

  @modelAction
  mergeToAndDelete(to: NoteBlockModel) {
    to.content.update(to.content.currentValue + this.content.currentValue);
    to.noteBlockRefs.push(...this.noteBlockRefs.map((r) => noteBlockRef(r.id)));
    to.linkedNoteIds.push(...this.linkedNoteIds);

    this.delete(false, false);
  }

  @modelAction
  updateAttrs(data: ModelCreationData<NoteBlockModel>) {
    if (
      data.content !== undefined &&
      data.content !== null &&
      data.content.currentValue !== this.content.currentValue
    ) {
      this.content = data.content;
    }

    if (data.noteId && data.noteId !== this.noteId) {
      this.noteId = data.noteId;
    }

    if (data.createdAt && data.createdAt !== this.createdAt) {
      this.createdAt = data.createdAt;
    }

    if (
      data.noteBlockRefs &&
      !isEqual(
        data.noteBlockRefs.map(({ id }) => id),
        this.noteBlockIds,
      )
    ) {
      const currentRefs = Object.fromEntries(
        this.noteBlockRefs
          .map((ref) => {
            return [ref.id, ref] as [string, Ref<NoteBlockModel>];
          })
          .map((data) => {
            detach(data[1]);

            return data;
          }),
      );

      this.noteBlockRefs = data.noteBlockRefs.map((ref) =>
        currentRefs[ref.id] ? currentRefs[ref.id] : ref,
      );
    }

    if (
      data.linkedNoteIds &&
      !isEqual(data.linkedNoteIds, this.linkedNoteIds)
    ) {
      this.linkedNoteIds = data.linkedNoteIds;
    }
  }

  @modelAction
  delete(recursively = true, spliceParent = true) {
    if (recursively) {
      this.noteBlockRefs.forEach((block) => block.current.delete(true));
    }

    if (spliceParent && this.parent) {
      this.parent.noteBlockRefs.splice(this.orderPosition, 1);
    }

    detach(this);
  }

  @modelAction
  updateNoteLinks(allNoteIds: string[]) {
    this.linkedNoteIds.forEach((id, index) => {
      if (!allNoteIds.includes(id)) {
        this.linkedNoteIds.splice(index, 1);
      }
    });

    allNoteIds.forEach((noteId) => {
      if (!this.linkedNoteIds.includes(noteId)) {
        this.linkedNoteIds.push(noteId);
      }
    });
  }

  @modelAction
  updateBlockLinks(allBlockIds: string[]) {
    this.linkedBlockIds.forEach((id, index) => {
      if (!allBlockIds.includes(id)) {
        this.linkedBlockIds.splice(index, 1);
      }
    });

    allBlockIds.forEach((blockId) => {
      if (!this.linkedBlockIds.includes(blockId)) {
        this.linkedBlockIds.push(blockId);
      }
    });
  }
}
