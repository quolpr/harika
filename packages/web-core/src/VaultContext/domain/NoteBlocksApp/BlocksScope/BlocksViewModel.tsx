import type { NoteBlockModel } from '../NoteBlockModel';
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
import { action, comparer, computed, makeObservable, observable } from 'mobx';
import type { ViewRegistry } from './ViewRegistry';
import type { TreeToken } from '../../../../blockParser/parseStringToTree';
import { addTokensToNoteBlock } from '../../../../blockParser/blockUtils';
import { isTodo } from '../../../../blockParser/astHelpers';
import { BlockContentModel } from '../NoteBlockModel/BlockContentModel';
import { getSnapshot, modelAction } from 'mobx-keystone';

export class BlocksViewModel implements ITreeNode<BlocksViewModel> {
  @observable noteBlock: NoteBlockModel;
  @observable cachedChildren: Record<string, NoteBlockModel> = {};
  $modelId: string;

  constructor(noteBlock: NoteBlockModel, private treeRegistry: ViewRegistry) {
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
    return this.treeRegistry.rootView === this;
  }

  @computed
  get isCollapsed() {
    return this.treeRegistry.collapsedBlockIds.has(this.noteBlock.$modelId);
  }

  @computed
  get isExpanded() {
    return !this.isCollapsed;
  }

  @computed
  get parent() {
    if (this.treeRegistry.rootView === this) return undefined;

    const parentBlock = this.noteBlock.parent;

    return parentBlock && this.treeRegistry.getOrCreateView(parentBlock);
  }

  @computed({ equals: comparer.shallow })
  get notCollapsedChildren(): BlocksViewModel[] {
    return this.noteBlock.noteBlockRefs
      .map(({ current }) => {
        return this.treeRegistry.getOrCreateView(current);
      })
      .filter((v) => !!v);
  }

  @computed({ equals: comparer.shallow })
  get children(): BlocksViewModel[] {
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
  get path(): BlocksViewModel[] {
    return pathFunc(this);
  }

  @computed
  get orderPosition() {
    return this.parent ? this.parent.orderHash[this.$modelId] : 0;
  }

  @computed({ equals: comparer.shallow })
  get siblings(): BlocksViewModel[] {
    return siblingsFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get flattenTree(): BlocksViewModel[] {
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
    left: BlocksViewModel | undefined,
    right: BlocksViewModel | undefined,
  ] {
    return leftAndRightSiblingFunc(this);
  }

  @computed
  get deepLastRightChild(): BlocksViewModel {
    return deepLastRightChildFunc(this);
  }

  @computed
  get nearestRightToParent(): BlocksViewModel | undefined {
    return nearestRightToParentFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRight(): [
    left: BlocksViewModel | undefined,
    right: BlocksViewModel | undefined,
  ] {
    return leftAndRightFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get allRightSiblings(): BlocksViewModel[] {
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

  toggleExpand() {
    if (this.isCollapsed) {
      this.treeRegistry.collapsedBlockIds.delete(this.$modelId);
    } else {
      this.treeRegistry.collapsedBlockIds.add(this.$modelId);
    }
  }

  toggleTodo(
    id: string,
    toggledModels: BlocksViewModel[] = [],
  ): BlocksViewModel[] {
    const token = this.content.getTokenById(id);

    if (!token || !isTodo(token)) return [];

    if (this.content.firstTodoToken?.id === id) {
      this.children.forEach((view) => {
        const firstTodo = view.content.firstTodoToken;

        if (firstTodo && firstTodo.ref === token.ref)
          view.toggleTodo(firstTodo.id, toggledModels);
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

    this.noteBlock.handleMerge(this.noteBlock, left.noteBlock);

    return left;
  }

  injectNewRightBlock(content: string, blockView: BlocksViewModel) {
    if (!this.parent) {
      throw new Error("Can't inject from root block");
    }

    const { injectTo, parentBlock } = (() => {
      if (this.children.length > 0) {
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

    return this.treeRegistry.createBlock(
      {
        content: new BlockContentModel({ value: content }),
        updatedAt: new Date().getTime(),
      },
      parentBlock,
      injectTo,
    );
  }

  @action
  injectNewTreeTokens(tokens: TreeToken[]): BlocksViewModel[] {
    return addTokensToNoteBlock(this.treeRegistry, this, tokens);
  }
}
