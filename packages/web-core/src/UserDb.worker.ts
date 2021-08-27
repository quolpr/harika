import { expose, proxy } from 'comlink';
import {
  BaseDbWorker,
  ApplyChangesService,
  SqlVaultsRepository,
} from './SqlNotesRepository.worker';
import { UserDbConflictsResolver } from './VaultsRepository/persistence/UserDbConflictResolver';

export class UserDbWorker extends BaseDbWorker {
  getVaultsRepo() {
    return proxy(new SqlVaultsRepository(this.syncRepo, this.db));
  }

  getApplyChangesService() {
    return proxy(
      new ApplyChangesService(
        this.db,
        new UserDbConflictsResolver(),
        this.syncRepo,
      ),
    );
  }
}

expose(UserDbWorker);
