import { BaseSyncRepository } from '../../../../extensions/SyncExtension/persistence/BaseSyncRepository';
import { BlocksScopesChangesApplier } from '../sync/BlocksScopesChangesApplier';

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
