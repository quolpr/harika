import { BaseSyncRepository } from '../../../../extensions/SyncExtension/persistence/BaseSyncRepository';
import type { IDatabaseChange } from '../../../../extensions/SyncExtension/synchronizer/types';

export const blocksScopesTable = 'blocksScopes' as const;

export type BlocksScopesRow = {
  id: string;
  collapsedBlockIds: string;
  noteId: string;
  scopedModelId: string;
  scopedModelType: string;
  rootBlockId: string;
};

export type BlocksScopeDoc = {
  id: string;
  collapsedBlockIds: string[];
  noteId: string;
  scopedModelId: string;
  scopedModelType: string;
  rootBlockId: string;
};

export type IBlocksScopesChangeEvent = IDatabaseChange<
  typeof blocksScopesTable,
  BlocksScopeDoc
>;

export class BlocksScopesRepository extends BaseSyncRepository<
  BlocksScopeDoc,
  BlocksScopesRow
> {
  getTableName() {
    return blocksScopesTable;
  }

  toDoc(row: BlocksScopesRow): BlocksScopeDoc {
    return {
      ...super.toDoc(row),
      collapsedBlockIds: JSON.parse(row.collapsedBlockIds),
    };
  }

  toRow(doc: BlocksScopeDoc): BlocksScopesRow {
    return {
      ...super.toRow(doc),
      collapsedBlockIds: JSON.stringify(doc.collapsedBlockIds),
    };
  }
}
