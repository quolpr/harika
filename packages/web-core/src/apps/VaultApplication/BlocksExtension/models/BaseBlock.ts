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

  @computed
  get hasChildren() {
    return this.childrenBlocks.length !== 0;
  }

  @computed({ equals: comparer.shallow })
  get noteBlockIds() {
    return this.childrenBlocks.map(({ $modelId }) => $modelId);
  }

  @computed
  get areLinksLoaded() {
    return !this.linkedBlockRefs.some((ref) => ref.maybeCurrent === undefined);
  }
}
