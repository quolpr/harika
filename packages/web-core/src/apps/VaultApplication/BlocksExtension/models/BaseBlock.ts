import { comparer, computed } from 'mobx';
import {
  detach,
  findParent,
  idProp,
  Model,
  model,
  modelAction,
  prop,
  Ref,
  rootRef,
  tProp,
  types,
} from 'mobx-keystone';

import { BlocksRegistry } from './BlocksRegistry';
import {
  deepLastRightChildFunc,
  flattenTreeFunc,
  getStringTreeFunc,
  leftAndRightFunc,
  leftAndRightSiblingFunc,
  nearestRightToParentFunc,
  pathFunc,
} from './treeFuncs';

export const blockRef = rootRef<BaseBlock>(
  'harika/BlocksExtension/BaseBlockRef',
);

@model('harika/BlocksExtension/BaseBlock')
export class BaseBlock extends Model({
  id: idProp,
  parentRef: prop<Ref<BaseBlock> | undefined>(),
  orderPosition: prop<number>(),
  areChildrenLoaded: prop<boolean>(() => true),
  createdAt: tProp(types.dateTimestamp),
  updatedAt: tProp(types.dateTimestamp),
}) {
  @computed
  get isParentLoaded() {
    if (!this.parentRef) return true; // It means root block

    return this.parentRef.maybeCurrent !== undefined;
  }

  @computed
  get isRoot() {
    return this.parentRef === undefined;
  }

  @computed({ equals: comparer.shallow })
  get childrenBlocks(): BaseBlock[] {
    const registry = findParent<BlocksRegistry>(
      this,
      (m) => m instanceof BlocksRegistry,
    );

    if (!registry) {
      return [];
    }

    return registry.getChildrenOfParent(this.$modelId);
  }

  get children() {
    return this.childrenBlocks;
  }

  @computed
  get index() {
    return this.siblings.findIndex((ch) => ch === this);
  }

  @computed({ equals: comparer.shallow })
  get childrenBlockIds() {
    return this.childrenBlocks.map(({ $modelId }) => $modelId);
  }

  @computed({ equals: comparer.shallow })
  get hasChildren() {
    return this.childrenBlocks.length !== 0;
  }

  @computed
  get siblings() {
    const parent = this.parentRef?.current;

    if (!parent) {
      throw new Error("You can't get sibling of root block");
    }

    return parent.childrenBlocks;
  }

  get parent() {
    return this.parentRef?.maybeCurrent;
  }

  @computed
  get path() {
    return pathFunc(this);
  }

  @computed
  get root() {
    return this.path[0];
  }

  @computed
  get flattenTree(): BaseBlock[] {
    return flattenTreeFunc<BaseBlock>(this);
  }

  @computed
  get deepLastRightChild(): BaseBlock | undefined {
    return deepLastRightChildFunc<BaseBlock>(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRightSibling(): [
    left: BaseBlock | undefined,
    right: BaseBlock | undefined,
  ] {
    return leftAndRightSiblingFunc(this);
  }

  @computed
  get nearestRightToParent(): BaseBlock | undefined {
    return nearestRightToParentFunc<BaseBlock>(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRight(): [
    left: BaseBlock | undefined,
    right: BaseBlock | undefined,
  ] {
    return leftAndRightFunc(this);
  }

  @modelAction
  move(parent: BaseBlock, pos: number | 'start' | 'end') {
    if (this.isRoot) {
      throw new Error("Can't move root block");
    }

    const newPos = (() => {
      if (pos === 'start') {
        return 0;
      } else if (pos === 'end') {
        return (
          Math.max(0, ...parent.childrenBlocks.map((ch) => ch.orderPosition)) +
          1
        );
      } else {
        return pos;
      }
    })();

    parent.childrenBlocks.forEach((block) => {
      if (block.orderPosition >= newPos) {
        block.orderPosition++;
      }
    });

    this.parentRef = blockRef(parent);
    this.orderPosition = newPos;
  }

  @modelAction
  mergeToAndDelete(to: BaseBlock) {
    this.childrenBlocks.forEach((ch) => {
      ch.parentRef = blockRef(to);
    });

    this.delete(false);
  }

  @modelAction
  delete(recursively = true) {
    if (recursively) {
      const toDelete = [...this.childrenBlocks];

      toDelete.forEach((block) => block.delete(recursively));
    }

    detach(this);
  }

  getStringTree(includeId: boolean, indent: number): string {
    return getStringTreeFunc(this, includeId, indent);
  }

  toString(): string {
    return '';
  }

  @computed
  get isTreeFullyLoaded(): boolean {
    if (!this.areChildrenLoaded) return false;

    const areNestedChildrenLoaded = this.childrenBlocks.every(
      (b) => b.areChildrenLoaded,
    );

    return areNestedChildrenLoaded;
  }

  @modelAction
  increaseSiblingsPosition(startFrom: number) {
    this.siblings
      .filter((bl) => bl.orderPosition >= startFrom)
      .forEach((bl) => {
        bl.orderPosition++;
      });
  }
}
