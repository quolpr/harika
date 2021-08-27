import { expose, proxy } from 'comlink';
import { VaultChangesApplier } from './VaultsContext/persistence/VaultChangesApplier/VaultChangesApplier';
import {
  BaseDbWorker,
  ApplyChangesService,
  SqlNotesRepository,
  SqlNotesBlocksRepository,
  DbChangesWriterService,
} from './SqlNotesRepository.worker';

export class VaultDbWorker extends BaseDbWorker {
  getNotesRepo() {
    return proxy(this.getNotesRepoWithoutProxy());
  }

  getNotesBlocksRepo() {
    return proxy(this.getNoteBlocksRepoWithoutProxy());
  }

  private getNotesRepoWithoutProxy() {
    return new SqlNotesRepository(this.syncRepo, this.db, this.windowId);
  }

  private getNoteBlocksRepoWithoutProxy() {
    return new SqlNotesBlocksRepository(this.syncRepo, this.db, this.windowId);
  }

  getApplyChangesService() {
    return proxy(
      new ApplyChangesService(
        new VaultChangesApplier(
          this.getNotesRepoWithoutProxy(),
          this.getNoteBlocksRepoWithoutProxy(),
          new DbChangesWriterService(),
        ),
        this.syncRepo,
      ),
    );
  }
}

expose(VaultDbWorker);
