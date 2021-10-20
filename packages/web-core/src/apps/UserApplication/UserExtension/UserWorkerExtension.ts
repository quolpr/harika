import { DB_MIGRATIONS } from '../../../extensions/DbExtension/types';
import { REPOS_WITH_SYNC } from '../../../extensions/SyncExtension/types';
import { BaseExtension } from '../../../framework/BaseExtension';
import { toRemoteName } from '../../../framework/utils';
import { initUsersDbTables } from './worker/migrations/initUsersDbTables';
import { VaultsRepository } from './worker/repositories/VaultsRepository';

export class UserWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(VaultsRepository).toSelf();
    this.container.bind(DB_MIGRATIONS).toConstantValue(initUsersDbTables);

    this.container
      .bind(toRemoteName(VaultsRepository))
      .toDynamicValue(() => this.container.get(VaultsRepository));

    this.container
      .bind(REPOS_WITH_SYNC)
      .toDynamicValue(() => this.container.get(VaultsRepository));
  }
}
