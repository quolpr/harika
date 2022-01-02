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
  children: prop<Ref<BaseBlock>[]>(() => []),
  createdAt: tProp(types.dateTimestamp),
  updatedAt: tProp(types.dateTimestamp),
  noteId: tProp(types.string),
  linkedBlockRefs: prop<Ref<BaseBlock>[]>(() => []),
}) {
  @computed
  get isRoot() {
    return rootBlockIdCtx.get(this) === this.$modelId;
  }

  @computed
  get parent(): BaseBlock | undefined {
    const backRefs = getRefsResolvingTo(this, blockRef);

    for (const backRef of backRefs.values()) {
      if (!backRef.maybeCurrent) continue;

      const model = backRef.current;

      // To be sure that it is not came from linkedBlockRefs
      if (model.children.some(({ id }) => id === this.$modelId)) {
        return model;
      }
    }

    return undefined;
  }

  @computed
  get hasChildren() {
    return this.children.length !== 0;
  }

  @computed({ equals: comparer.shallow })
  get noteBlockIds() {
    return this.children.map(({ id }) => id);
  }

  @computed
  get orderPosition() {
    return this.parent?.children.findIndex((n) => n.id === this.$modelId)!;
  }

  @computed
  get areChildrenLoaded() {
    return !this.children.some((ref) => ref.maybeCurrent === undefined);
  }

  @computed
  get areLinksLoaded() {
    return !this.linkedBlockRefs.some((ref) => ref.maybeCurrent === undefined);
  }
}
