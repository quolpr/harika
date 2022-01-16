import {
  applySnapshot,
  detach,
  fromSnapshot,
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

export class BlocksStore extends Model({
  blocksRegistry: prop<BlocksRegistry>(),
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

  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleModelChanges(
    blocksAttrs: SnapshotInOf<BaseBlock>[],
    deletedBlockIds: SyncModelId<BaseBlock>[],
  ) {
    blocksAttrs.forEach((block) => {
      if (!this.blocksRegistry.hasBlockWithId(block.$modelId!)) {
        this.blocksRegistry.registerBlock(fromSnapshot<BaseBlock>(block));
      } else {
        applySnapshot<BaseBlock>(
          this.blocksRegistry.getBlockById(block.$modelId!),
          block as any,
        );
      }
    });

    deletedBlockIds.forEach((id) => {
      if (this.blocksRegistry.hasBlockWithId(id.value)) {
        this.deleteBlock(this.blocksRegistry.getBlockById(id.value));
      }
    });
  }

  @modelAction
  deleteBlock(block: BaseBlock, spliceParent = true, recursively = true) {
    const toDelete = [...block.childrenBlocks];

    if (recursively) {
      toDelete.forEach((block) =>
        this.deleteBlock(block, spliceParent, recursively),
      );
    }

    if (spliceParent && block.parentRef?.current) {
      block.parentRef?.current.childrenBlocks.splice(block.orderPosition, 1);
    }

    detach(block);
  }
}
