import {
  detach,
  Model,
  modelAction,
  ModelCreationData,
  prop,
} from 'mobx-keystone';
import { withoutSyncAction } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';
import { withoutUndoAction } from '../../../../lib/utils';
import { BaseBlock } from './BaseBlock';

export class BlocksStore extends Model({
  // TODO: maybe mote to separate object for performance reasons
  blocksMap: prop<Record<string, BaseBlock>>(() => ({})),
}) {
  @modelAction
  registerBlock(block: BaseBlock) {
    this.blocksMap[block.$modelId] = block;
  }

  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleModelChanges(
    blocksAttrs: (ModelCreationData<BaseBlock> & {
      $modelId: string;
    })[],
    deletedBlockIds: SyncModelId<BaseBlock>[],
  ) {
    blocksAttrs.forEach((block) => {
      if (!this.blocksMap[block.$modelId]) {
        // TODO this.blocksMap[block.$modelId] = new  ...
      } else {
        // TODO updating
      }
    });

    deletedBlockIds.forEach((id) => {
      if (this.blocksMap[id.value]) {
        this.deleteBlock(this.blocksMap[id.value]);
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
