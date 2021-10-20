import { BaseSyncWorkerExtension } from '../../../extensions/SyncExtension/BaseSyncWorkerExtension';
import { initUsersDbTables } from './worker/migrations/initUsersDbTables';
import { VaultsRepository } from './worker/repositories/VaultsRepository';

export class UserWorkerExtension extends BaseSyncWorkerExtension {
  repos() {
    return [{ repo: VaultsRepository, withSync: true, remote: true }];
  }

  migrations() {
    return [initUsersDbTables];
  }
}
