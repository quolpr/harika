import {
  idProp,
  Model,
  model,
  modelAction,
  ModelData,
  prop,
} from 'mobx-keystone';
import { Class } from 'utility-types';

import { withoutChangeTrackingAction } from '../../../../extensions/SyncExtension/mobx-keystone/trackChanges';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';
import { withoutUndoAction } from '../../../../lib/utils';
import { applyModelData } from './applyModelData';
import { BaseBlock } from './BaseBlock';
import { BlocksRegistry } from './BlocksRegistry';

@model('harika/BlocksExtension/BlocksStore')
export class BlocksStore extends Model({
  id: idProp,
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
  @withoutChangeTrackingAction
  @modelAction
  handleModelChanges(
    blocksAttrs: { klass: Class<BaseBlock>; datas: ModelData<BaseBlock>[] }[],
    deletedBlockIds: SyncModelId<BaseBlock>[],
  ) {
    blocksAttrs.forEach(({ klass, datas }) => {
      datas.forEach((block) => {
        if (this.blocksRegistry.hasBlockWithId(block.id!)) {
          applyModelData(
            this.blocksRegistry.getBlockById(block.id!),
            block,
            (key, oldVal, newVal) => {
              if (key === 'areChildrenLoaded') {
                if (oldVal === true) return true;
              }

              return newVal;
            },
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
