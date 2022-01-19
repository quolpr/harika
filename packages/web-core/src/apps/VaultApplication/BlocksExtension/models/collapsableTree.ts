import { comparer, computed, makeObservable } from 'mobx';
import { BlocksScope } from '../../BlocksScopeExtension/models/BlocksScope';
import { BaseBlock } from './BaseBlock';
import {
  deepLastRightChildFunc,
  flattenTreeFunc,
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

export class CollapsableBlock {
  constructor(private scope: BlocksScope, public originalBlock: BaseBlock) {
    makeObservable(this);
  }

  get $modelId() {
    return this.originalBlock.$modelId;
  }

  @computed
  get isRoot() {
    return this.scope.rootScopedBlockId === this.originalBlock.$modelId;
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
  get path() {
    return pathFunc(this);
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
}
