import { comparer, computed, makeObservable } from 'mobx';
import { BlocksScope } from './BlocksScope';
import { BaseBlock } from './BaseBlock';
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
  WeakMap<BaseBlock, CollapsableBlock>
> = new WeakMap();

export const getCollapsableBlock = (scope: BlocksScope, block: BaseBlock) => {
  if (!blocks.get(scope)) {
    blocks.set(scope, new WeakMap<BaseBlock, CollapsableBlock>());
  }

  if (!blocks.get(scope)!.get(block)) {
    blocks.get(scope)!.set(block, new CollapsableBlock(scope, block));
  }

  return blocks.get(scope)!.get(block)!;
};

export class CollapsableBlock<T extends BaseBlock = BaseBlock> {
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
  get childrenBlocks(): CollapsableBlock[] {
    if (this.isCollapsed) {
      return [];
    } else {
      return this.originalBlock.childrenBlocks.map((ch) =>
        getCollapsableBlock(this.scope, ch),
      );
    }
  }

  get children() {
    return this.childrenBlocks;
  }

  @computed
  get parent(): CollapsableBlock | undefined {
    const originalParent = this.originalBlock.parentRef?.current;

    if (this.isRoot || !originalParent) return undefined;

    return getCollapsableBlock(this.scope, originalParent);
  }

  @computed
  get path(): CollapsableBlock[] {
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
  get flattenTree(): CollapsableBlock[] {
    return flattenTreeFunc<CollapsableBlock>(this);
  }

  @computed
  get deepLastRightChild(): CollapsableBlock | undefined {
    return deepLastRightChildFunc<CollapsableBlock>(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRightSibling(): [
    left: CollapsableBlock | undefined,
    right: CollapsableBlock | undefined,
  ] {
    return leftAndRightSiblingFunc(this);
  }

  @computed
  get nearestRightToParent(): CollapsableBlock | undefined {
    return nearestRightToParentFunc<CollapsableBlock>(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRight(): [
    left: CollapsableBlock | undefined,
    right: CollapsableBlock | undefined,
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
    let [, right] = this.leftAndRightSibling;

    if (!right) {
      right = this.nearestRightToParent;
    }

    if (!right) return;

    if (!right.parent) {
      throw new Error("Right couldn't be root block");
    }

    if (right.children.length) {
      this.originalBlock.move(right.originalBlock, 'start');
    } else {
      this.originalBlock.move(
        right.parent.originalBlock,
        right.originalBlock.orderPosition,
      );
    }
  }

  tryMoveUp() {
    const [left] = this.leftAndRightSibling;

    // Don't handle such case otherwise current block will be hidden
    if (left?.children.length !== 0 && left?.isCollapsed) return;

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
