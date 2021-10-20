import { BaseExtension } from '../../../framework/BaseExtension';
import { toRemoteName } from '../../../framework/utils';
import { BlocksScopesRepository } from './worker/repositories/BlockScopesRepository';
import { DB_MIGRATIONS } from '../../../extensions/DbExtension/types';
import { addBlockScopeTable } from './worker/migrations/addBlockScopeTable';
import { REPOS_WITH_SYNC } from '../../../extensions/SyncExtension/types';

export default class BlocksScopeWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(BlocksScopesRepository).toSelf();

    this.container
      .bind(toRemoteName(BlocksScopesRepository))
      .toDynamicValue(() => this.container.get(BlocksScopesRepository));

    this.container.bind(DB_MIGRATIONS).toConstantValue(addBlockScopeTable);

    this.container
      .bind(REPOS_WITH_SYNC)
      .toDynamicValue(() => this.container.get(BlocksScopesRepository));
  }
}
