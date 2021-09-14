import { ArraySet, Model, model, modelAction, prop } from 'mobx-keystone';
import type { ModelCreationData, Ref } from 'mobx-keystone';
import { ScopedBlock } from './ScopedBlock';
import { action, computed, observable } from 'mobx';
import type { NoteBlockModel } from '../models/NoteBlockModel';
import type { Optional } from 'utility-types';
import type { BlockModelsRegistry } from '../models/BlockModelsRegistry';

export const scopedBlocksRegistryType = '@harika/ScopedBlocksRegistry';
export const isScopedBlocksRegistry = (
  obj: any,
): obj is ScopedBlocksRegistry => {
  return obj.$modelType === scopedBlocksRegistryType;
};

@model(scopedBlocksRegistryType)
export class ScopedBlocksRegistry extends Model({
  blocksRegistryRef: prop<Ref<BlockModelsRegistry>>(),
  collapsedBlockIds: prop<ArraySet<string>>(),
  rootScopedBlockId: prop<string>(),
}) {
  @observable scopedBlocksMap: Record<string, ScopedBlock> = {};

  @action
  getOrCreateScopedBlock(block: NoteBlockModel) {
    if (this.scopedBlocksMap[block.$modelId]) {
      return this.scopedBlocksMap[block.$modelId];
    } else {
      const newView = new ScopedBlock(block, this);
      this.scopedBlocksMap[newView.$modelId] = newView;
      return newView;
    }
  }

  @action
  removeScopedBlock(blockId: string) {
    delete this.scopedBlocksMap[blockId];
  }

  getScopedBlock(id: string) {
    return this.scopedBlocksMap[id];
  }

  @computed
  get rootScopedBlock() {
    return this.scopedBlocksMap[this.rootScopedBlockId];
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
    parent: ScopedBlock,
    pos: number | 'append',
  ) {
    const block = this.blocksRegistryRef.current.createBlock(
      attrs,
      parent.noteBlock,
      pos,
    );

    return this.getOrCreateScopedBlock(block);
  }

  @modelAction
  deleteNoteBlockIds(ids: string[]) {
    this.blocksRegistryRef.current.deleteNoteBlockIds(ids);
  }
}
