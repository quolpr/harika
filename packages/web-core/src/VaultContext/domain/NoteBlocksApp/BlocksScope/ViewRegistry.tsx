import { ArraySet, Model, model, modelAction, prop } from 'mobx-keystone';
import type { ModelCreationData, Ref } from 'mobx-keystone';
import { BlocksViewModel } from './BlocksViewModel';
import { action, computed, observable } from 'mobx';
import type { NoteBlockModel } from '../NoteBlockModel';
import type { Optional } from 'utility-types';
import type { BlocksRegistry } from '../BlocksRegistry';

export const viewRegistryType = '@harika/NoteBlockViewRegistry';
export const isViewRegistry = (obj: any): obj is ViewRegistry => {
  return obj.$modelType === viewRegistryType;
};

@model(viewRegistryType)
export class ViewRegistry extends Model({
  blocksRegistryRef: prop<Ref<BlocksRegistry>>(),
  collapsedBlockIds: prop<ArraySet<string>>(),
  rootViewId: prop<string>(),
}) {
  @observable viewsMap: Record<string, BlocksViewModel> = {};

  @action
  getOrCreateView(block: NoteBlockModel) {
    if (this.viewsMap[block.$modelId]) {
      return this.viewsMap[block.$modelId];
    } else {
      const newView = new BlocksViewModel(block, this);
      this.viewsMap[newView.$modelId] = newView;
      return newView;
    }
  }

  @action
  removeView(block: NoteBlockModel) {
    delete this.viewsMap[block.$modelId];
  }

  getView(id: string) {
    return this.viewsMap[id];
  }

  @computed
  get rootView() {
    return this.viewsMap[this.rootViewId];
  }

  @computed
  get noteId() {
    return this.blocksRegistryRef.current.noteId;
  }

  @modelAction
  createBlock(
    attrs: Optional<
      ModelCreationData<NoteBlockModel>,
      'createdAt' | 'noteId' | 'noteBlockRefs' | 'linkedNoteIds' | 'updatedAt'
    >,
    parent: BlocksViewModel,
    pos: number | 'append',
  ) {
    const block = this.blocksRegistryRef.current.createBlock(
      attrs,
      parent.noteBlock,
      pos,
    );

    return this.getOrCreateView(block);
  }

  @modelAction
  deleteNoteBlockIds(ids: string[]) {
    this.blocksRegistryRef.current.deleteNoteBlockIds(ids);
  }
}
