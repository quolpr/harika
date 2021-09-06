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
import { BlockContentModel } from './NoteBlockModel/BlockContentModel';
import type { BlocksViewModel } from './VaultUiState/BlocksViewModel';
import type { TreeToken } from '../../blockParser/parseStringToTree';
import { addTokensToNoteBlock } from '../../blockParser/blockUtils';
import { isTodo } from '../../blockParser/astHelpers';
import type { BlocksTreeHolder } from './BlocksTreeHolder';
import { treeHolderType } from './BlocksTreeHolder';
import {
  allRightSiblingsFunc,
  deepLastRightChildFunc,
  flattenTreeFunc,
  getStringTreeFunc,
  indentFunc,
  ITreeNode,
  leftAndRightFunc,
  leftAndRightSiblingFunc,
  mergeToLeftAndDeleteFunc,
  moveFunc,
  nearestRightToParentFunc,
  orderHashFunc,
  pathFunc,
  siblingsFunc,
} from '../../mobx-tree';

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

  getStringTree(
    includeId: boolean = false,
    indent = this.isRoot ? -1 : 0,
  ): string {
    return getStringTreeFunc(this, includeId, indent);
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
    moveFunc(this, parent, pos);
  }

  @modelAction
  mergeToLeftAndDelete(): NoteBlockModel | undefined {
    return mergeToLeftAndDeleteFunc(this);
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
  tryMoveLeft() {
    if (!this.parent) {
      throw new Error("Can't move root block");
    }

    const [left] = this.leftAndRight;

    if (!left) return;

    if (!left.parent) {
      throw new Error("Left couldn't be root block");
    }

    if (left === this.parent) {
      // If left block is parent

      this.move(left.parent, left.orderPosition);
    } else if (left.parent !== this.parent) {
      // If left is child of child of child...

      this.move(left.parent, left.orderPosition + 1);
    } else {
      // if same level

      this.move(this.parent, left.orderPosition);
    }
  }

  @modelAction
  tryMoveRight() {
    let [, right] = this.leftAndRightSibling;

    if (!right) {
      right = this.nearestRightToParent;
    }

    if (!right) return;

    if (!right.parent) {
      throw new Error("Right couldn't be root block");
    }

    if (right.noteBlockRefs.length) {
      this.move(right, 'start');
    } else {
      this.move(right.parent, right.orderPosition);
    }
  }

  @modelAction
  tryMoveUp() {
    const [left] = this.leftAndRightSibling;

    if (left) {
      this.move(left, 'end');
    }
  }

  @modelAction
  tryMoveDown() {
    const parentRef = this.parent;
    const parentOfParent = parentRef?.parent;

    if (!parentRef || !parentOfParent) return;

    this.move(parentOfParent, parentRef.orderPosition + 1);
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
  toggleTodo(id: string, toggledIds: string[] = []): string[] {
    const token = this.content.getTokenById(id);

    if (!token || !isTodo(token)) return [];

    if (this.content.firstTodoToken?.id === id) {
      this.noteBlockRefs.forEach((blockRef) => {
        const firstTodo = blockRef.current.content.firstTodoToken;

        if (firstTodo && firstTodo.ref === token.ref)
          blockRef.current.toggleTodo(firstTodo.id, toggledIds);
      });
    }

    this.content.toggleTodo(id);

    toggledIds.push(this.$modelId);

    return toggledIds;
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
