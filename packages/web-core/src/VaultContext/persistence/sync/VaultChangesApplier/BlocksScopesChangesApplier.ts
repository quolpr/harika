import type {
  IDatabaseChange,
  IDeleteChange,
  IUpdateChange,
} from '../../../../db-sync/synchronizer/types';
import type {
  BlocksScopeDoc,
  blocksScopesTable,
} from '../../BlockScopesRepository';
import { BaseChangesApplier } from './BaseChangesApplier';

export class BlocksScopesChangesConflictResolver extends BaseChangesApplier<
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
}
