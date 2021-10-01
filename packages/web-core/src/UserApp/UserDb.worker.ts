import { proxy, expose } from 'comlink';
import { initSyncTables } from '../apps-migrations/initSyncTables';
import { initUsersDbTables } from '../apps-migrations/initUsersDbTables';
import {
  ApplyChangesService,
  DbChangesWriterService,
} from '../db/sync/persistence/ApplyChangesService';
import { BaseDbSyncWorker } from '../db/sync/persistence/BaseDbSyncWorker';
import { IMigration } from '../db/core/types';
import { UserDbChangesApplier } from './services/UserDbChangesApplier';
import { SqlVaultsRepository } from './repositories/VaultsRepository';

export class UserDbWorker extends BaseDbSyncWorker {
  getVaultsRepo() {
    return proxy(
      new SqlVaultsRepository(this.syncRepo, this.db, this.windowId),
    );
  }

  private getVaultsRepoWithoutProxy() {
    return new SqlVaultsRepository(this.syncRepo, this.db, this.windowId);
  }

  getApplyChangesService() {
    const vaultsRepo = this.getVaultsRepoWithoutProxy();

    return proxy(
      new ApplyChangesService(
        new UserDbChangesApplier(vaultsRepo, new DbChangesWriterService()),
        this.syncRepo,
      ),
    );
  }

  migrations(): IMigration[] {
    return [initSyncTables, initUsersDbTables];
  }
}

expose(UserDbWorker);