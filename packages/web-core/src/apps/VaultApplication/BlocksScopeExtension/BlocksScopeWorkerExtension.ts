import { BaseExtension } from '../../../framework/BaseExtension';
import { toRemoteName } from '../../../framework/utils';
import { BlocksScopesRepository } from './repositories/BlockScopesRepository';
import { DB_MIGRATIONS } from '../../../extensions/DbExtension/types';
import { addBlockScopeTable } from './migrations/addBlockScopeTable';

export default class BlocksScopeWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(BlocksScopesRepository).toSelf();

    this.container
      .bind(toRemoteName(BlocksScopesRepository))
      .toDynamicValue(() => this.container.get(BlocksScopesRepository));

    this.container.bind(DB_MIGRATIONS).toConstantValue(addBlockScopeTable);
  }
}
