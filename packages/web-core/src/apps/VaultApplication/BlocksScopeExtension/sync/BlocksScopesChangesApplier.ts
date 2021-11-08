import type {
  IDatabaseChange,
  IDeleteChange,
  IUpdateChange,
} from '../../../../extensions/SyncExtension/serverSynchronizer/types';
import {
  BlocksScopeDoc,
  blocksScopesTable,
} from '../repositories/BlockScopesRepository';
import { BaseChangesApplier } from '../../../../extensions/SyncExtension/BaseChangesApplier';

export class BlocksScopesChangesApplier extends BaseChangesApplier<
  typeof blocksScopesTable,
  BlocksScopeDoc
> {
  protected resolveUpdateUpdate(
    change1: IUpdateChange<typeof blocksScopesTable, BlocksScopeDoc>,
    _change2: IUpdateChange<typeof blocksScopesTable, BlocksScopeDoc>,
  ): IUpdateChange<typeof blocksScopesTable, BlocksScopeDoc> {
    return change1;
  }

  protected resolveUpdateDelete(
    _change1: IUpdateChange<typeof blocksScopesTable, BlocksScopeDoc>,
    change2: IDeleteChange<typeof blocksScopesTable, BlocksScopeDoc>,
  ): IDatabaseChange<typeof blocksScopesTable, BlocksScopeDoc> {
    return change2;
  }

  get tableName() {
    return blocksScopesTable;
  }
}
