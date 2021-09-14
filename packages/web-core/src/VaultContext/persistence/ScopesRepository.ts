import { BaseSyncRepository } from '../../db-sync/persistence/BaseSyncRepository';

export const blocksViewsTable = 'blocksScopes' as const;

export type BlocksScopesRow = {
  id: string;
  collapsedBlockIds: string;
  noteId: string;
  scopedModelId: string;
  scopedModelType: string;
};

export type BlocksScopeDoc = {
  id: string;
  collapsedBlockIds: string[];
  noteId: string;
  scopedModelId: string;
  scopedModelType: string;
};

export class SqlBlocksViewsRepository extends BaseSyncRepository<
  BlocksScopeDoc,
  BlocksScopesRow
> {
  getTableName() {
    return blocksViewsTable;
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
