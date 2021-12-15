import { BaseSyncRepository } from '../../../../extensions/SyncExtension/BaseSyncRepository';

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
}
