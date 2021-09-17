import { Model, model, modelAction, prop } from 'mobx-keystone';
import type { ModelCreationData, Ref } from 'mobx-keystone';
import { ScopedBlock } from './ScopedBlock';
import { action, computed, observable } from 'mobx';
import type { NoteBlockModel } from '../models/NoteBlockModel';
import type { Optional } from 'utility-types';
import type { BlockModelsRegistry } from '../models/BlockModelsRegistry';
import { collapsedBlockIdsCtx, rootScopedBlockIdCtx } from './BlocksScope';
import { addTokensToNoteBlock } from '../../../../blockParser/blockUtils';
import type { TreeToken } from '../../../../blockParser/parseStringToTree';

export const scopedBlocksRegistryType = '@harika/ScopedBlocksRegistry';
export const isScopedBlocksRegistry = (
  obj: any,
): obj is ScopedBlocksRegistry => {
  return obj.$modelType === scopedBlocksRegistryType;
};

@model(scopedBlocksRegistryType)
export class ScopedBlocksRegistry extends Model({
  blocksRegistryRef: prop<Ref<BlockModelsRegistry>>(),
}) {
  @observable scopedBlocksMap: Record<string, ScopedBlock> = {};

  @action
  getOrCreateScopedBlock = (blockId: string) => {
    if (this.scopedBlocksMap[blockId]) {
      return this.scopedBlocksMap[blockId];
    } else {
      const newBlock: ScopedBlock = new ScopedBlock(
        this.blocksRegistryRef.current.getBlockById(blockId),
        computed(() => {
          return collapsedBlockIdsCtx.get(this);
        }),
        computed(() => this.rootScopedBlock),
        this.getOrCreateScopedBlock,
        this.createBlock,
      );
      this.scopedBlocksMap[newBlock.$modelId] = newBlock;

      return newBlock;
    }
  };

  @action
  removeScopedBlock(blockId: string) {
    delete this.scopedBlocksMap[blockId];
  }

  getScopedBlock(id: string) {
    return this.scopedBlocksMap[id];
  }

  @computed
  get rootScopedBlock() {
    return this.scopedBlocksMap[rootScopedBlockIdCtx.get(this)!];
  }

  @computed
  get noteId() {
    return this.blocksRegistryRef.current.noteId;
  }

  @modelAction
  createBlock = (
    attrs: Optional<
      ModelCreationData<NoteBlockModel>,
      'createdAt' | 'noteId' | 'noteBlockRefs' | 'linkedNoteIds' | 'updatedAt'
    >,
    parent: ScopedBlock,
    pos: number | 'append',
  ) => {
    const block = this.blocksRegistryRef.current.createBlock(
      attrs,
      parent.noteBlock,
      pos,
    );

    return this.getOrCreateScopedBlock(block.$modelId);
  };

  @modelAction
  deleteNoteBlockIds(ids: string[]) {
    this.blocksRegistryRef.current.deleteNoteBlockIds(ids);
  }

  @modelAction
  injectNewTreeTokens(block: ScopedBlock, tokens: TreeToken[]): ScopedBlock[] {
    return addTokensToNoteBlock(this, block, tokens);
  }
}
