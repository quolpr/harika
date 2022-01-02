import {
  applySnapshot,
  detach,
  fromSnapshot,
  Model,
  modelAction,
  prop,
  SnapshotOutOf,
} from 'mobx-keystone';
import { withoutSyncAction } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';
import { withoutUndoAction } from '../../../../lib/utils';
import { BaseBlock } from './BaseBlock';
import { BlocksRegistry } from './BlocksRegistry';

export class BlocksStore extends Model({
  blocksRegistry: prop<BlocksRegistry>(),
}) {
  @modelAction
  registerBlock(block: BaseBlock) {
    this.blocksRegistry.registerBlock(block);
  }

  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleModelChanges(
    blocksAttrs: SnapshotOutOf<BaseBlock>[],
    deletedBlockIds: SyncModelId<BaseBlock>[],
  ) {
    blocksAttrs.forEach((block) => {
      if (!this.blocksRegistry.hasBlockWithId(block.$modelId)) {
        this.blocksRegistry.registerBlock(fromSnapshot<BaseBlock>(block));
      } else {
        applySnapshot<BaseBlock>(
          this.blocksRegistry.getBlockById(block.$modelId),
          block,
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
    const toDelete = [...block.children];

    if (recursively) {
      toDelete.forEach((block) =>
        this.deleteBlock(block.current, spliceParent, recursively),
      );
    }

    if (spliceParent && block.parent) {
      block.parent.children.splice(block.orderPosition, 1);
    }

    detach(block);
  }
}
