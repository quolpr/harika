import type {
  BlocksViewDocType,
  IDatabaseChange,
  IDeleteChange,
  IUpdateChange,
  VaultDbTables,
} from '../../../dexieTypes';
import { BaseConflictResolver } from './BaseConflictResolver';

export class BlocksViewsChangesConflictResolver extends BaseConflictResolver<
  VaultDbTables.BlocksViews,
  BlocksViewDocType
> {
  protected resolveUpdateUpdate(
    change1: IUpdateChange<VaultDbTables.BlocksViews, BlocksViewDocType>,
    _change2: IUpdateChange<VaultDbTables.BlocksViews, BlocksViewDocType>,
  ): IUpdateChange<VaultDbTables.BlocksViews, BlocksViewDocType> {
    return change1;
  }

  protected resolveUpdateDelete(
    _change1: IUpdateChange<VaultDbTables.BlocksViews, BlocksViewDocType>,
    change2: IDeleteChange<VaultDbTables.BlocksViews, BlocksViewDocType>,
  ): IDatabaseChange<VaultDbTables.BlocksViews, BlocksViewDocType> {
    return change2;
  }
}
