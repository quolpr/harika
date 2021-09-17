import type { NoteBlockModel } from '../models/NoteBlockModel';
import {
  allRightSiblingsFunc,
  deepLastRightChildFunc,
  flattenTreeFunc,
  indentFunc,
  leftAndRightFunc,
  leftAndRightSiblingFunc,
  nearestRightToParentFunc,
  orderHashFunc,
  pathFunc,
  siblingsFunc,
} from '../../../../mobx-tree';
import type { ITreeNode } from '../../../../mobx-tree';
import { comparer, computed, makeObservable, observable } from 'mobx';
import type { IComputedValue } from 'mobx';
import { isTodo } from '../../../../blockParser/astHelpers';
import { BlockContentModel } from '../models/BlockContentModel';
import type { ArraySet, ModelCreationData } from 'mobx-keystone';
import type { Optional } from 'utility-types';

// It is not usual mobx-keystone model, it is just mobx model
// We don't need to store and serialize the state in global state
// so for performance & memory reasons plain mobx model is used
export class ScopedBlock implements ITreeNode<ScopedBlock> {
  @observable noteBlock: NoteBlockModel;
  $modelId: string;

  constructor(
    noteBlock: NoteBlockModel,
    private collapsedBlockIds: IComputedValue<ArraySet<string>>,
    private rootScopedBlock: IComputedValue<ScopedBlock>,
    private getOrCreateScopedBlock: (blockId: string) => ScopedBlock,
    private createBlock: (
      attrs: Optional<
        ModelCreationData<NoteBlockModel>,
        'createdAt' | 'noteId' | 'noteBlockRefs' | 'linkedNoteIds' | 'updatedAt'
      >,
      parent: ScopedBlock,
      pos: number | 'append',
    ) => ScopedBlock,
  ) {
    makeObservable(this);
    this.$modelId = noteBlock.$modelId;
    this.noteBlock = noteBlock;
  }

  @computed
  get noteId() {
    return this.noteBlock.noteId;
  }

  @computed
  get textContent() {
    return this.content.value;
  }

  @computed
  get content() {
    return this.noteBlock.content;
  }

  @computed
  get isRoot() {
    return this.rootScopedBlock.get() === this;
  }

  @computed
  get isCollapsed() {
    return !!this.collapsedBlockIds.get()?.has(this.noteBlock.$modelId);
  }

  @computed
  get isExpanded() {
    return !this.isCollapsed;
  }

  @computed
  get parent(): ScopedBlock | undefined {
    if (this.rootScopedBlock.get() === this) return undefined;

    const parentBlock = this.noteBlock.parent;

    return parentBlock && this.getOrCreateScopedBlock(parentBlock.$modelId);
  }

  @computed({ equals: comparer.shallow })
  get notCollapsedChildren(): ScopedBlock[] {
    return this.noteBlock.noteBlockRefs
      .map(({ id }) => {
        return this.getOrCreateScopedBlock(id);
      })
      .filter((v) => !!v);
  }

  @computed({ equals: comparer.shallow })
  get children(): ScopedBlock[] {
    if (this.isCollapsed) {
      return [];
    } else {
      return this.notCollapsedChildren;
    }
  }

  @computed({ equals: comparer.shallow })
  get orderHash(): Record<string, number> {
    return orderHashFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get path(): ScopedBlock[] {
    return pathFunc(this);
  }

  @computed
  get orderPosition() {
    return this.parent ? this.parent.orderHash[this.$modelId] : 0;
  }

  @computed({ equals: comparer.shallow })
  get siblings(): ScopedBlock[] {
    return siblingsFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get flattenTree(): ScopedBlock[] {
    return flattenTreeFunc(this);
  }

  @computed
  get indent(): number {
    return indentFunc(this);
  }

  @computed
  get hasChildren() {
    return this.children.length !== 0;
  }

  @computed({ equals: comparer.shallow })
  get leftAndRightSibling(): [
    left: ScopedBlock | undefined,
    right: ScopedBlock | undefined,
  ] {
    return leftAndRightSiblingFunc(this);
  }

  @computed
  get deepLastRightChild(): ScopedBlock {
    return deepLastRightChildFunc(this);
  }

  @computed
  get nearestRightToParent(): ScopedBlock | undefined {
    return nearestRightToParentFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRight(): [
    left: ScopedBlock | undefined,
    right: ScopedBlock | undefined,
  ] {
    return leftAndRightFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get allRightSiblings(): ScopedBlock[] {
    return allRightSiblingsFunc(this);
  }

  getStringTree(includeId: boolean, indent: number): string {
    let str = this.isRoot
      ? ''
      : `${'  '.repeat(indent)}- ${this.textContent}${
          includeId ? ` [#${this.$modelId}]` : ''
        }\n`;

    this.children.forEach((node) => {
      str += node.getStringTree(includeId, node.isRoot ? 0 : indent + 1);
    });

    return str;
  }

  @computed
  get linkedNoteIds() {
    return this.noteBlock.linkedNoteIds;
  }

  toggleTodo(id: string, toggledModels: ScopedBlock[] = []): ScopedBlock[] {
    const token = this.content.getTokenById(id);

    if (!token || !isTodo(token)) return [];

    if (this.content.firstTodoToken?.id === id) {
      this.children.forEach((block) => {
        const firstTodo = block.content.firstTodoToken;

        if (firstTodo && firstTodo.ref === token.ref)
          block.toggleTodo(firstTodo.id, toggledModels);
      });
    }

    this.content.toggleTodo(id);

    toggledModels.push(this);

    return toggledModels;
  }

  // TODO: rename all like moveLeft to tryMoveLeft
  moveLeft() {
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

      this.noteBlock.move(left.parent.noteBlock, left.orderPosition);
    } else if (left.parent !== this.parent) {
      // If left is child of child of child...

      this.noteBlock.move(left.parent.noteBlock, left.orderPosition + 1);
    } else {
      // if same level

      this.noteBlock.move(left.parent.noteBlock, left.orderPosition);
    }
  }

  moveRight() {
    let [, right] = this.leftAndRightSibling;

    if (!right) {
      right = this.nearestRightToParent;
    }

    if (!right) return;

    if (!right.parent) {
      throw new Error("Right couldn't be root block");
    }

    if (right.children.length) {
      this.noteBlock.move(right.noteBlock, 'start');
    } else {
      this.noteBlock.move(right.parent.noteBlock, right.orderPosition);
    }
  }

  moveUp() {
    const [left] = this.leftAndRightSibling;

    // Don't handle such case otherwise current block will be hidden
    if (left?.notCollapsedChildren.length !== 0 && left?.isCollapsed) return;

    if (left) {
      this.noteBlock.move(left.noteBlock, 'end');
    }
  }

  moveDown() {
    const parentRef = this.parent;
    const parentOfParent = parentRef?.parent;

    if (!parentRef || !parentOfParent) return;

    this.noteBlock.move(parentOfParent.noteBlock, parentRef.orderPosition + 1);
  }

  mergeToLeftAndDelete() {
    const [left] = this.leftAndRight;

    if (!left) return;

    this.noteBlock.mergeToAndDelete(left.noteBlock);

    return left;
  }

  injectNewLeftBlock(content: string) {
    if (!this.parent) {
      throw new Error("Can't inject from root block");
    }

    return this.createBlock(
      {
        content: new BlockContentModel({ value: content }),
        updatedAt: new Date().getTime(),
      },
      this.parent,
      this.orderPosition,
    );
  }

  handleEnterPress(caretPosStart: number) {
    const content = this.content.value;

    let newContent = '';
    let startAt = 0;
    let newBlock: ScopedBlock | undefined = undefined;
    let focusOn: ScopedBlock | undefined = undefined;

    if (caretPosStart === 0 && content.length !== 0) {
      newBlock = this.injectNewLeftBlock(newContent);
      focusOn = newBlock;
    } else if (
      caretPosStart > 0 &&
      caretPosStart !== content.length &&
      this.children.length > 0
    ) {
      newBlock = this.injectNewLeftBlock(content.slice(0, caretPosStart));
      this.content.update(content.slice(caretPosStart, content.length));

      focusOn = this;
    } else {
      if (caretPosStart !== content.length) {
        newContent = content.slice(caretPosStart, content.length);

        this.content.update(content.slice(0, caretPosStart));
      }

      if (
        (this.content.hasTodo ||
          (this.children.length > 0 && this.children[0].content.hasTodo)) &&
        newContent.length === 0
      ) {
        newContent = '[[TODO]] ';
        startAt = newContent.length;
      }

      newBlock = this.injectNewRightBlock(newContent);
      focusOn = newBlock;
    }

    return { focusStartAt: startAt, focusOn, newBlock };
  }

  injectNewRightBlock(content: string) {
    if (!this.parent) {
      throw new Error("Can't inject from root block");
    }

    const { injectTo, parentBlock } = (() => {
      if (this.children.length > 0 && content.length === 0) {
        return {
          injectTo: 0,
          parentBlock: this,
        };
      } else if (this.children.length > 0 && content.length !== 0) {
        return {
          injectTo: 0,
          parentBlock: this,
        };
      } else {
        return {
          injectTo: this.orderPosition + 1,
          parentBlock: this.parent,
        };
      }
    })();

    return this.createBlock(
      {
        content: new BlockContentModel({ value: content }),
        updatedAt: new Date().getTime(),
      },
      parentBlock,
      injectTo,
    );
  }
}
