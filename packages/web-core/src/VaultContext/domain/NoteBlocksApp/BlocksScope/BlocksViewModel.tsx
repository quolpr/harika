import {
  findParent,
  Model,
  model,
  modelAction,
  prop,
  Ref,
} from 'mobx-keystone';
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
import { comparer, computed } from 'mobx';
import { isViewRegistry, ViewRegistry } from './ViewRegistry';
import type { TreeToken } from '../../../../blockParser/parseStringToTree';
import { addTokensToNoteBlock } from '../../../../blockParser/blockUtils';
import { isTodo } from '../../../../blockParser/astHelpers';

@model('harika/BlocksTreeNodeModel')
export class BlocksViewModel
  extends Model({
    noteBlockRef: prop<Ref<NoteBlockModel>>(),
  })
  implements ITreeNode<BlocksViewModel>
{
  @computed
  get noteBlockId() {
    return this.noteBlockRef.id;
  }

  @computed
  get textContent() {
    return this.content.value;
  }

  @computed
  get content() {
    return this.noteBlockRef.current.content;
  }

  @computed
  get isRoot() {
    return this.treeRegistry.rootView === this;
  }

  @computed
  get treeRegistry() {
    return findParent<ViewRegistry>(this, isViewRegistry)!;
  }

  @computed
  get isCollapsed() {
    return this.treeRegistry.collapsedBlockIds.has(this.noteBlockRef.id);
  }

  @computed
  get isExpanded() {
    return !this.isCollapsed;
  }

  @computed
  get parent() {
    if (this.treeRegistry.rootView === this) return undefined;

    const parentBlock = this.noteBlockRef.current.parent;

    return (
      parentBlock &&
      this.treeRegistry.viewsMap[
        this.treeRegistry.blockViewIdsMap[parentBlock.$modelId]
      ]
    );
  }

  @computed({ equals: comparer.shallow })
  get notCollapsedChildren(): BlocksViewModel[] {
    return this.noteBlockRef.current.noteBlockRefs.map(({ id }) => {
      return this.treeRegistry.viewsMap[this.treeRegistry.blockViewIdsMap[id]];
    });
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
          includeId ? ` [#${this.noteBlockRef.id}]` : ''
        }\n`;

    this.children.forEach((node) => {
      str += node.getStringTree(includeId, node.isRoot ? 0 : indent + 1);
    });

    return str;
  }

  @computed
  get linkedNoteIds() {
    return this.noteBlockRef.current.linkedNoteIds;
  }

  @modelAction
  toggleExpand() {
    if (this.isCollapsed) {
      this.treeRegistry.collapsedBlockIds.delete(this.noteBlockId);
    } else {
      this.treeRegistry.collapsedBlockIds.add(this.noteBlockId);
    }
  }

  @modelAction
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
  @modelAction
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

      this.noteBlockRef.current.move(
        left.parent.noteBlockRef.current,
        left.orderPosition,
      );
    } else if (left.parent !== this.parent) {
      // If left is child of child of child...

      this.noteBlockRef.current.move(
        left.parent.noteBlockRef.current,
        left.orderPosition + 1,
      );
    } else {
      // if same level

      this.noteBlockRef.current.move(
        left.parent.noteBlockRef.current,
        left.orderPosition,
      );
    }
  }

  @modelAction
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
      this.noteBlockRef.current.move(
        right.parent.noteBlockRef.current,
        'start',
      );
    } else {
      this.noteBlockRef.current.move(
        right.parent.noteBlockRef.current,
        right.orderPosition,
      );
    }
  }

  @modelAction
  moveUp() {
    const [left] = this.leftAndRightSibling;

    if (left) {
      this.noteBlockRef.current.move(left.noteBlockRef.current, 'end');
    }
  }

  @modelAction
  moveDown() {
    const parentRef = this.parent;
    const parentOfParent = parentRef?.parent;

    if (!parentRef || !parentOfParent) return;

    this.noteBlockRef.current.move(
      parentOfParent.noteBlockRef.current,
      parentRef.orderPosition + 1,
    );
  }

  @modelAction
  mergeToLeftAndDelete() {
    const [left] = this.leftAndRight;

    if (!left) return;

    this.noteBlockRef.current.handleMerge(
      this.noteBlockRef.current,
      left.noteBlockRef.current,
    );

    return left;
  }

  @modelAction
  injectNewRightBlock(content: string, blockView: BlocksViewModel) {
    if (!this.parent) {
      throw new Error("Can't inject from root block");
    }

    const { injectTo, parentBlock } = (() => {
      if (this.children.length > 0) {
        return {
          injectTo: 0,
          parentBlock: this.noteBlockRef.current,
        };
      } else {
        return {
          injectTo: this.orderPosition + 1,
          parentBlock: this.parent.noteBlockRef.current,
        };
      }
    })();

    const newNoteBlock = parentBlock.createChildBlock(content, injectTo);

    return this.treeRegistry.viewsMap[
      this.treeRegistry.blockViewIdsMap[newNoteBlock.$modelId]
    ];
  }

  @modelAction
  injectNewTreeTokens(tokens: TreeToken[]): BlocksViewModel[] {
    const noteBlocks = addTokensToNoteBlock(
      this.noteBlockRef.current.treeRegistry,
      this.noteBlockRef.current,
      tokens,
    );

    return noteBlocks.map((block) => {
      return this.treeRegistry.viewsMap[
        this.treeRegistry.blockViewIdsMap[block.id]
      ];
    });
  }
}
