import { proxy, expose } from 'comlink';
import {
  ApplyChangesService,
  DbChangesWriterService,
} from '../../db-sync/persistence/ApplyChangesService';
import { BaseDbSyncWorker } from '../../db-sync/persistence/BaseDbSyncWorker';
import { UserDbChangesApplier } from './UserDbChangesApplier';
import { SqlVaultsRepository } from './VaultsRepository';

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
}

expose(UserDbWorker);
