import { expose, proxy } from 'comlink';
import {
  BaseDbWorker,
  ApplyChangesService,
  SqlVaultsRepository,
  DbChangesWriterService,
} from './SqlNotesRepository.worker';
import { UserDbChangesApplier } from './UserContext/persistence/UserDbChangesApplier';

export class UserDbWorker extends BaseDbWorker {
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
