import { ArraySet, model, Model, modelAction, prop } from 'mobx-keystone';
import { withoutUndoAction } from '../../../../lib/utils';
import { syncable } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';

export const blocksScopeType = 'harika/noteBlocks/BlocksScope';

@syncable
@model(blocksScopeType)
export class BlocksScope extends Model({
  rootScopedBlockId: prop<string>(),
  collapsedBlockIds: prop<ArraySet<string>>(),
  noteId: prop<string>(),

  scopedModelId: prop<string>(),
  scopedModelType: prop<string>(),
}) {
  @withoutUndoAction
  @modelAction
  toggleExpand(blockId: string) {
    if (this.collapsedBlockIds.has(blockId)) {
      this.collapsedBlockIds.delete(blockId);
    } else {
      this.collapsedBlockIds.add(blockId);
    }
  }
}
