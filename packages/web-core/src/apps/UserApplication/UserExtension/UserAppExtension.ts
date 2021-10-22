import { injectable } from 'inversify';
import { VaultsRepository } from './worker/repositories/VaultsRepository';
import { UserVaultsService } from './app/services/UserVaultsService';
import { initUsersDbTables } from './worker/migrations/initUsersDbTables';
import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';

@injectable()
export class UserAppExtension extends BaseSyncExtension {
  async register() {
    await super.register();

    this.container.bind(UserVaultsService).toSelf();
  }

  repos() {
    return [{ repo: VaultsRepository, withSync: true }];
  }

  migrations() {
    return [initUsersDbTables];
  }
}
