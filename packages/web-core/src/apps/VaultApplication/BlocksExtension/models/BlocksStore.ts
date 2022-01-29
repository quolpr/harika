import { model, Model, modelAction, ModelData, prop } from 'mobx-keystone';
import { Class } from 'utility-types';
import { withoutSyncAction } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';
import { withoutUndoAction } from '../../../../lib/utils';
import { applyModelData } from './applyModelData';
import { BaseBlock } from './BaseBlock';
import { BlocksRegistry } from './BlocksRegistry';

@model('harika/BlocksExtension/BlocksStore')
export class BlocksStore extends Model({
  blocksRegistry: prop<BlocksRegistry>(() => new BlocksRegistry({})),
}) {
  hasBlockWithId(id: string) {
    return this.blocksRegistry.hasBlockWithId(id);
  }

  getBlockById(id: string) {
    return this.blocksRegistry.getBlockById(id);
  }

  getBlocksByIds(ids: string[]) {
    return ids.map((id) => this.getBlockById(id));
  }

  @modelAction
  deletedBlockByIds(ids: string[]) {
    this.getBlocksByIds(ids).forEach((block) => {
      block.delete(true);
    });
  }

  @modelAction
  registerBlock(block: BaseBlock) {
    this.blocksRegistry.registerBlock(block);
  }

  @modelAction
  registerBlocks(blocks: BaseBlock[]) {
    this.blocksRegistry.registerBlocks(blocks);
  }

  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleModelChanges(
    blocksAttrs: { klass: Class<BaseBlock>; datas: ModelData<BaseBlock>[] }[],
    deletedBlockIds: SyncModelId<BaseBlock>[],
  ) {
    blocksAttrs.forEach(({ klass, datas }) => {
      datas.forEach((block) => {
        if (this.blocksRegistry.hasBlockWithId(block.$modelId!)) {
          applyModelData(
            this.blocksRegistry.getBlockById(block.$modelId!),
            block,
          );
        } else {
          this.blocksRegistry.registerBlock(new klass(block));
        }
      });
    });

    deletedBlockIds.forEach((id) => {
      if (this.blocksRegistry.hasBlockWithId(id.value)) {
        this.blocksRegistry.getBlockById(id.value).delete(false);
      }
    });
  }
}