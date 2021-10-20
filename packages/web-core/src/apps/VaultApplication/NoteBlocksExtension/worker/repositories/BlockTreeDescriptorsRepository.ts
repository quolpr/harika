import { BaseSyncRepository } from '../../../../../extensions/SyncExtension/worker/BaseSyncRepository';
import { remotable } from '../../../../../framework/utils';
import { BlocksScopesChangesApplier } from '../../../BlocksScopeExtension/worker/sync/BlocksScopesChangesApplier';

export const blocksTreeDescriptorsTable = 'blocksTreesDescriptors' as const;

export type BlocksTreeDescriptorRow = {
  id: string; // = noteId
  rootBlockId: string;
};

export type BlocksTreeDescriptorDoc = BlocksTreeDescriptorRow;

@remotable('BlocksTreeDescriptorsRepository')
export class BlocksTreeDescriptorsRepository extends BaseSyncRepository<
  BlocksTreeDescriptorDoc,
  BlocksTreeDescriptorRow
> {
  getTableName() {
    return blocksTreeDescriptorsTable;
  }

  changesApplier() {
    // TODO: write own changes applier
    return new BlocksScopesChangesApplier();
  }
}
