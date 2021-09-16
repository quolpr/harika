import type { ModelCreationData, Ref } from 'mobx-keystone';
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
import { BlockModelsRegistry, blocksRegistryType } from './BlockModelsRegistry';
import { isBlocksApp, NoteBlocksApp } from '../NoteBlocksApp';

const isRegistry = (obj: any): obj is BlockModelsRegistry => {
  return obj.$modelType === blocksRegistryType;
};

export const noteBlockRef = customRef<NoteBlockModel>('harika/NoteBlockRef', {
  resolve(ref) {
    const app = findParent<NoteBlocksApp>(this, isBlocksApp);

    if (!app) {
      return undefined;
    }

    return app.getNoteBlock(ref.id);
  },

  onResolvedValueChange(ref, newTodo, oldTodo) {
    if (oldTodo && !newTodo) {
      // if the todo value we were referencing disappeared then remove the reference
      // from its parent
      detach(ref);
    }
  },
});

@model('harika/NoteBlockModel')
export class NoteBlockModel extends Model({
  noteId: prop<string>(),
  content: prop<BlockContentModel>(),
  noteBlockRefs: prop<Ref<NoteBlockModel>[]>(),
  linkedNoteIds: prop<string[]>(),
  createdAt: tProp(types.dateTimestamp),
  updatedAt: tProp(types.dateTimestamp),
  isDeleted: prop<boolean>(false),
}) {
  @computed
  get isRoot() {
    return this.treeRegistry.rootBlockId === this.$modelId;
  }

  @computed
  get treeRegistry() {
    return findParent<BlockModelsRegistry>(this, isRegistry)!;
  }

  @computed
  get parent(): NoteBlockModel | undefined {
    const id = this.treeRegistry.childParentRelations[this.$modelId];

    return id === undefined ? undefined : this.treeRegistry.blocksMap[id];
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
    if (!this.parent) {
      throw new Error("Can't move root block");
    }

    this.parent.noteBlockRefs.splice(this.orderPosition, 1);

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
    to.content.update(to.content.value + this.content.value);
    to.noteBlockRefs.push(...this.noteBlockRefs.map((r) => noteBlockRef(r.id)));
    to.linkedNoteIds.push(...this.linkedNoteIds);

    this.delete(false, false);
  }

  @modelAction
  updateAttrs(data: ModelCreationData<NoteBlockModel>) {
    if (
      data.content !== undefined &&
      data.content !== null &&
      data.content.value !== this.content.value
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
  delete(recursively = true, links = true) {
    if (recursively) {
      this.noteBlockRefs.forEach((block) => block.current.delete(true, links));
    }

    if (this.parent) {
      this.parent.noteBlockRefs.splice(this.orderPosition, 1);
    }

    this.isDeleted = true;
  }

  @modelAction
  updateLinks(allNoteIds: string[]) {
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
}
