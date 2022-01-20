import {
  applySnapshot,
  fromSnapshot,
  model,
  Model,
  modelAction,
  prop,
  SnapshotInOf,
} from 'mobx-keystone';
import { withoutSyncAction } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';
import { withoutUndoAction } from '../../../../lib/utils';
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
    blocksAttrs: SnapshotInOf<BaseBlock>[],
    deletedBlockIds: SyncModelId<BaseBlock>[],
  ) {
    blocksAttrs.forEach((block) => {
      if (this.blocksRegistry.hasBlockWithId(block.$modelId!)) {
        applySnapshot<BaseBlock>(
          this.blocksRegistry.getBlockById(block.$modelId!),
          block as any,
        );
      } else {
        this.blocksRegistry.registerBlock(fromSnapshot<BaseBlock>(block));
      }
    });

    deletedBlockIds.forEach((id) => {
      if (this.blocksRegistry.hasBlockWithId(id.value)) {
        this.blocksRegistry.getBlockById(id.value).delete(false);
      }
    });
  }
}
