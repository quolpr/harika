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
import type { BlocksTreeHolder } from './BlocksTreeHolder';
import { treeHolderType } from './BlocksTreeHolder';
import {
  allRightSiblingsFunc,
  deepLastRightChildFunc,
  flattenTreeFunc,
  indentFunc,
  ITreeNode,
  leftAndRightFunc,
  leftAndRightSiblingFunc,
  nearestRightToParentFunc,
  orderHashFunc,
  pathFunc,
  siblingsFunc,
} from '../../mobx-tree';
import type { BlockContentModel } from './NoteBlockModel/BlockContentModel';
import { isTodo } from '../../blockParser/astHelpers';

const isTreeHolder = (obj: any): obj is BlocksTreeHolder => {
  return obj.$modelType === treeHolderType;
};

export const noteBlockRef = customRef<NoteBlockModel>('harika/NoteBlockRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const rootBlock = findParent<BlocksTreeHolder>(this, isTreeHolder);

    if (!rootBlock) {
      return undefined;
    }

    return rootBlock.blocksMap[ref.id];
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
export class NoteBlockModel
  extends Model({
    noteId: prop<string>(),
    content: prop<BlockContentModel>(),
    noteBlockRefs: prop<Ref<NoteBlockModel>[]>(),
    linkedNoteIds: prop<string[]>(),
    createdAt: tProp(types.dateTimestamp),
    updatedAt: tProp(types.dateTimestamp),
    isDeleted: prop<boolean>(false),
    isRoot: prop<boolean>(),
  })
  implements ITreeNode<NoteBlockModel>
{
  @computed
  get nodeId() {
    return this.$modelId;
  }

  @computed
  get treeHolder() {
    return findParent<BlocksTreeHolder>(this, isTreeHolder)!;
  }

  @computed
  get textContent() {
    return this.content.value;
  }

  @computed({ equals: comparer.shallow })
  get children() {
    return this.noteBlockRefs.map(({ current }) => current);
  }

  @computed
  get parent() {
    const id = this.treeHolder.childParentRelations[this.$modelId];

    return id === undefined ? undefined : this.treeHolder.blocksMap[id];
  }

  @computed({ equals: comparer.shallow })
  get flattenTree(): NoteBlockModel[] {
    return flattenTreeFunc(this);
  }

  @computed
  get indent(): number {
    return indentFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get orderHash(): Record<string, number> {
    return orderHashFunc(this);
  }

  @computed
  get orderPosition() {
    return this.parent ? this.parent.orderHash[this.$modelId] : 0;
  }

  @computed
  get hasChildren() {
    return this.children.length !== 0;
  }

  @computed({ equals: comparer.shallow })
  get path(): NoteBlockModel[] {
    return pathFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get siblings(): NoteBlockModel[] {
    return siblingsFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRightSibling(): [
    left: NoteBlockModel | undefined,
    right: NoteBlockModel | undefined,
  ] {
    return leftAndRightSiblingFunc(this);
  }

  @computed
  get deepLastRightChild(): NoteBlockModel {
    return deepLastRightChildFunc(this);
  }

  @computed
  get nearestRightToParent(): NoteBlockModel | undefined {
    return nearestRightToParentFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRight(): [
    left: NoteBlockModel | undefined,
    right: NoteBlockModel | undefined,
  ] {
    return leftAndRightFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get allRightSiblings(): NoteBlockModel[] {
    return allRightSiblingsFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get noteBlockIds() {
    return this.noteBlockRefs.map(({ id }) => id);
  }

  @modelAction
  spliceChild(start: number, deleteCount?: number, ...nodes: NoteBlockModel[]) {
    if (deleteCount) {
      this.noteBlockRefs.splice(
        start,
        deleteCount,
        ...nodes.map((node) => noteBlockRef(node)),
      );
    } else {
      this.noteBlockRefs.splice(start);
    }
  }

  @modelAction
  move(parent: NoteBlockModel, pos: number | 'start' | 'end') {
    if (!this.parent) {
      throw new Error("Can't move root block");
    }

    this.parent.spliceChild(this.orderPosition, 1);

    const newPos = (() => {
      if (pos === 'start') {
        return 0;
      } else if (pos === 'end') {
        return parent.children.length;
      } else {
        return pos;
      }
    })();

    this.parent.spliceChild(newPos, this.orderPosition, this);
  }

  @modelAction
  handleMerge(from: NoteBlockModel, to: NoteBlockModel) {
    to.content.update(to.content.value + from.content.value);
    to.noteBlockRefs.push(...from.noteBlockRefs.map((r) => noteBlockRef(r.id)));
    to.linkedNoteIds.push(...from.linkedNoteIds);

    from.delete(false, false);
  }

  @modelAction
  appendChildBlock(block: NoteBlockModel) {
    this.noteBlockRefs.push(noteBlockRef(block));
  }

  @modelAction
  merge(rootBlock: NoteBlockModel) {
    const noteBlockRefs = rootBlock.noteBlockRefs;
    rootBlock.noteBlockRefs = [];

    if (this.isRoot) {
      this.noteBlockRefs.splice(0, 0, ...noteBlockRefs);
    } else {
      this.parent!.noteBlockRefs.splice(
        this.orderPosition + 1,
        0,
        ...noteBlockRefs,
      );
    }
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

    if (data.isRoot !== undefined && data.isRoot !== this.isRoot) {
      this.isRoot = data.isRoot;
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

  @modelAction
  toggleTodo(id: string, toggledIds: string[] = []): string[] {
    const token = this.content.getTokenById(id);

    if (!token || !isTodo(token)) return [];

    if (this.content.firstTodoToken?.id === id) {
      this.children.forEach((view) => {
        const firstTodo = view.content.firstTodoToken;

        if (firstTodo && firstTodo.ref === token.ref)
          view.toggleTodo(firstTodo.id, toggledIds);
      });
    }

    this.content.toggleTodo(id);

    toggledIds.push(this.$modelId);

    return toggledIds;
  }
}
