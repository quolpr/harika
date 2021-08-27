import { expose, proxy } from 'comlink';
import { ConflictsResolver } from './NotesRepository/persistence/ConflictsResolver/ConflictsResolver';
import {
  BaseDbWorker,
  ApplyChangesService,
  SqlNotesRepository,
  SqlNotesBlocksRepository,
} from './SqlNotesRepository.worker';

export class VaultDbWorker extends BaseDbWorker {
  getNotesRepo() {
    return proxy(new SqlNotesRepository(this.syncRepo, this.db));
  }

  getNotesBlocksRepo() {
    return proxy(new SqlNotesBlocksRepository(this.syncRepo, this.db));
  }

  getApplyChangesService() {
    return proxy(
      new ApplyChangesService(this.db, new ConflictsResolver(), this.syncRepo),
    );
  }
}

expose(VaultDbWorker);
