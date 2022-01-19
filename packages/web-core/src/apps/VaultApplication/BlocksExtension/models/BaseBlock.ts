import {
  Model,
  model,
  prop,
  Ref,
  tProp,
  types,
  rootRef,
  getRefsResolvingTo,
} from 'mobx-keystone';
import { comparer, computed } from 'mobx';
import { rootBlockIdCtx } from '../../NoteBlocksExtension/models/NoteBlockModel';
import {
  deepLastRightChildFunc,
  flattenTreeFunc,
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
  get isRoot() {
    return rootBlockIdCtx.get(this) === this.$modelId;
  }

  @computed({ equals: comparer.shallow })
  get childrenBlocks(): BaseBlock[] {
    const backRefs = getRefsResolvingTo(this, blockRef);

    const blocks: BaseBlock[] = [];

    for (const backRef of backRefs.values()) {
      if (!backRef.maybeCurrent) continue;

      const model = backRef.current;

      // To be sure that it is not came from linkedBlockRefs
      if (model.parentRef?.id === this.$modelId) {
        blocks.push(model);
      }
    }

    return blocks;
  }

  get children() {
    return this.childrenBlocks;
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

  toString(): string {
    return '';
  }
}
