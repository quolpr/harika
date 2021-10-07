import { BaseSyncRepository } from '../../../../extensions/SyncExtension/persistence/BaseSyncRepository';
import { BlocksScopesChangesApplier } from '../sync/BlocksScopesChangesApplier';

export const blocksTreesTable = 'blocksTrees' as const;

export type BlocksScopesRow = {
  id: string; // = noteId
  rootBlockId: string;
};

export type BlocksScopeDoc = BlocksScopesRow;

export class BlocksScopesRepository extends BaseSyncRepository<
  BlocksScopeDoc,
  BlocksScopesRow
> {
  getTableName() {
    return blocksTreesTable;
  }

  changesApplier() {
    // TODO: write own changes applier
    return new BlocksScopesChangesApplier();
  }
}
