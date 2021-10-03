import type {
  IDatabaseChange,
  IDeleteChange,
  IUpdateChange,
} from '../../../../../lib/db/sync/synchronizer/types';
import type {
  BlocksScopeDoc,
  blocksScopesTable,
} from '../../repositories/BlockScopesRepository';
import { BaseChangesApplier } from '../../../services/sync/VaultChangesApplier/BaseChangesApplier';

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
