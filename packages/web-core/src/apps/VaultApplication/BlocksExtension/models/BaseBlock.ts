import {
  Model,
  model,
  prop,
  Ref,
  tProp,
  types,
  rootRef,
  getRefsResolvingTo,
  modelAction,
  detach,
  createContext,
  getSnapshot,
  getParent,
} from 'mobx-keystone';
import { comparer, computed } from 'mobx';
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
  parentRef: prop<Ref<BaseBlock> | undefined>(),
  orderPosition: prop<number>(),
  linkedBlockRefs: prop<Ref<BaseBlock>[]>(() => []),
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
    const backRefs = getRefsResolvingTo(this, blockRef, {
      updateAllRefsIfNeeded: true,
    });

    const blocks: BaseBlock[] = [];

    for (const backRef of backRefs.values()) {
      const parent = getParent<BaseBlock>(backRef);

      if (!parent || !(parent instanceof BaseBlock)) continue;

      blocks.push(parent);
    }

    return blocks.sort((a, b) => a.orderPosition - b.orderPosition);
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
  get areLinksLoaded() {
    return !this.linkedBlockRefs.some((ref) => ref.maybeCurrent === undefined);
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
        return parent.childrenBlocks.length;
      } else {
        return pos;
      }
    })();

    parent.childrenBlocks.forEach((block) => {
      if (block.orderPosition >= pos) {
        block.orderPosition++;
      }
    });

    this.parentRef = blockRef(parent);
    this.orderPosition = newPos;
  }

  @modelAction
  mergeToAndDelete(to: BaseBlock) {
    to.linkedBlockRefs.push(...this.linkedBlockRefs.map((r) => blockRef(r.id)));

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

  // O(n^2)
  @modelAction
  updateLinks(allBlockIds: string[]) {
    this.linkedBlockRefs.forEach((idRef) => {
      if (!allBlockIds.includes(idRef.id)) {
        this.linkedBlockRefs.splice(this.linkedBlockRefs.indexOf(idRef), 1);
      }
    });

    allBlockIds.forEach((blockId) => {
      if (!this.linkedBlockRefs.find((ref) => ref.id === blockId)) {
        this.linkedBlockRefs.push(blockRef(blockId));
      }
    });
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
