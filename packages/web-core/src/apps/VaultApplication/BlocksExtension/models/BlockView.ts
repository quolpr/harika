import { comparer, computed, makeObservable } from 'mobx';

import { BaseBlock } from './BaseBlock';
import { BlocksScope } from './BlocksScope';
import {
  deepLastRightChildFunc,
  flattenTreeFunc,
  getStringTreeFunc,
  leftAndRightFunc,
  leftAndRightSiblingFunc,
  nearestRightToParentFunc,
  pathFunc,
} from './treeFuncs';

const blocks: WeakMap<
  BlocksScope,
  WeakMap<BaseBlock, BlockView>
> = new WeakMap();

export const getBlockView = (scope: BlocksScope, block: BaseBlock) => {
  if (!blocks.get(scope)) {
    blocks.set(scope, new WeakMap<BaseBlock, BlockView>());
  }

  if (!blocks.get(scope)!.get(block)) {
    blocks.get(scope)!.set(block, new BlockView(scope, block));
  }

  return blocks.get(scope)!.get(block)!;
};

export class BlockView<T extends BaseBlock = BaseBlock> {
  constructor(private scope: BlocksScope, public originalBlock: T) {
    makeObservable(this);
  }

  get $modelId() {
    return this.originalBlock.$modelId;
  }

  @computed
  get isRoot() {
    return this.scope.rootBlockId === this.originalBlock.$modelId;
  }

  @computed
  get isCollapsed() {
    return !!this.scope.collapsedBlockIds.has(this.originalBlock.$modelId);
  }

  @computed
  get isExpanded() {
    return !this.isCollapsed;
  }

  @computed({ equals: comparer.shallow })
  get childrenBlocks(): BlockView[] {
    if (this.isCollapsed) {
      return [];
    } else {
      return this.originalBlock.childrenBlocks.map((ch) =>
        getBlockView(this.scope, ch),
      );
    }
  }

  get children() {
    return this.childrenBlocks;
  }

  @computed
  get parent(): BlockView | undefined {
    const originalParent = this.originalBlock.parentRef?.current;

    if (this.isRoot || !originalParent) return undefined;

    return getBlockView(this.scope, originalParent);
  }

  @computed
  get path(): BlockView[] {
    return pathFunc(this);
  }

  @computed
  get indent() {
    return this.path.length;
  }

  @computed
  get siblings() {
    if (!this.parent) {
      throw new Error("You can't get sibling of root block");
    }

    return this.parent.childrenBlocks;
  }

  @computed
  get flattenTree(): BlockView[] {
    return flattenTreeFunc<BlockView>(this);
  }

  @computed
  get deepLastRightChild(): BlockView | undefined {
    return deepLastRightChildFunc<BlockView>(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRightSibling(): [
    left: BlockView | undefined,
    right: BlockView | undefined,
  ] {
    return leftAndRightSiblingFunc(this);
  }

  @computed
  get nearestRightToParent(): BlockView | undefined {
    return nearestRightToParentFunc<BlockView>(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRight(): [
    left: BlockView | undefined,
    right: BlockView | undefined,
  ] {
    return leftAndRightFunc(this);
  }

  getStringTree(includeId: boolean, indent: number): string {
    return getStringTreeFunc(this, includeId, indent);
  }

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

      this.originalBlock.move(
        left.parent.originalBlock,
        left.originalBlock.orderPosition,
      );
    } else if (left.parent !== this.parent) {
      // If left is child of child of child...

      this.originalBlock.move(
        left.parent.originalBlock,
        left.originalBlock.orderPosition + 1,
      );
    } else {
      // if same level

      this.originalBlock.move(
        left.parent.originalBlock,
        left.originalBlock.orderPosition,
      );
    }
  }

  tryMoveRight() {
    const { right, isRightSibling } = (() => {
      const [, right] = this.leftAndRightSibling;

      if (right) {
        return { right, isRightSibling: true };
      } else {
        return { right: this.nearestRightToParent, isRightSibling: false };
      }
    })();

    if (!right) return;

    if (!right.parent) {
      throw new Error("Right couldn't be root block");
    }

    if (right.children.length) {
      this.originalBlock.move(right.originalBlock, 'start');
    } else {
      this.originalBlock.move(
        right.parent.originalBlock,
        isRightSibling
          ? right.originalBlock.orderPosition + 1
          : right.originalBlock.orderPosition,
      );
    }
  }

  tryMoveUp() {
    const [left] = this.leftAndRightSibling;

    // Don't handle such case otherwise current block will be hidden
    if (left?.originalBlock?.children.length !== 0 && left?.isCollapsed) return;

    if (left) {
      this.originalBlock.move(left.originalBlock, 'end');
    }
  }

  tryMoveDown() {
    const parent = this.parent;
    const parentOfParent = parent?.parent;

    if (!parent || !parentOfParent) return;

    this.originalBlock.move(
      parentOfParent.originalBlock,
      parent.originalBlock.orderPosition + 1,
    );
  }

  mergeToLeftAndDelete() {
    const [left] = this.leftAndRight;

    if (!left) return;

    this.originalBlock.mergeToAndDelete(left.originalBlock);

    return left;
  }
}
