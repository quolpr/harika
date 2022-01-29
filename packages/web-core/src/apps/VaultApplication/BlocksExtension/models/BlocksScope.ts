import { computed } from 'mobx';
import { ArraySet, model, Model, modelAction, prop } from 'mobx-keystone';
import { syncable } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { normalizeBlockTree } from '../../../../lib/blockParser/blockUtils';
import { withoutUndoAction } from '../../../../lib/utils';
import { CollapsableBlock } from './CollapsableBlock';

export const blocksScopeType = '@harika/BlocksExtension/BlocksScope';

// TODO: move selection to separate class
@syncable
@model(blocksScopeType)
export class BlocksScope extends Model({
  collapsedBlockIds: prop<ArraySet<string>>(),
  rootBlockId: prop<string>(),

  scopeId: prop<string>(),
  scopeType: prop<string>(),
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
