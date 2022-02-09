import { IDocChange } from '@harika/sync-common';

import { BaseSyncRepository } from '../../../../extensions/SyncExtension/BaseSyncRepository';

export const blocksScopesTable = 'blocksScopes' as const;

export type BlocksScopesRow = {
  id: string;
  collapsedBlockIds: string;
  scopeId: string;
  scopeType: string;
  rootBlockId: string;
};

export type BlocksScopeDoc = {
  id: string;
  collapsedBlockIds: string[];
  scopeId: string;
  scopeType: string;
  rootBlockId: string;
};

export type IBlocksScopesChangeEvent = IDocChange<
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
