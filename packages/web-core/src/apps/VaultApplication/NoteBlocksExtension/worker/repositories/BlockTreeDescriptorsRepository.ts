import { BaseSyncRepository } from '../../../../../extensions/SyncExtension/worker/BaseSyncRepository';
import { BlocksScopesChangesApplier } from '../../../BlocksScopeExtension/worker/sync/BlocksScopesChangesApplier';

export const blocksTreeDescriptorsTable = 'blocksTreesDescriptors' as const;

export type BlocksTreeDescriptorRow = {
  id: string; // = noteId
  rootBlockId: string;
};

export type BlocksTreeDescriptorDoc = BlocksTreeDescriptorRow;

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
