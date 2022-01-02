import {
  Model,
  model,
  prop,
  Ref,
  tProp,
  types,
  createContext,
  rootRef,
} from 'mobx-keystone';

import { comparer, computed } from 'mobx';
import { rootBlockIdCtx } from '../../NoteBlocksExtension/models/NoteBlockModel';

export const parentBlockCtx = createContext<BaseBlock | undefined>();

export const blockRef = rootRef<BaseBlock>(
  'harika/BlocksExtension/BaseBlockRef',
);

@model('harika/BlocksExtension/BaseBlock')
export class BaseBlock extends Model({
  children: prop<Ref<BaseBlock>[]>(() => []),
  createdAt: tProp(types.dateTimestamp),
  updatedAt: tProp(types.dateTimestamp),
  type: tProp(types.string),
  noteId: tProp(types.string),
  linkedBlockIds: prop<string[]>(() => []),
}) {
  @computed
  get isRoot() {
    return rootBlockIdCtx.get(this) === this.$modelId;
  }

  @computed
  get parent(): BaseBlock | undefined {
    return parentBlockCtx.get(this);
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
}
