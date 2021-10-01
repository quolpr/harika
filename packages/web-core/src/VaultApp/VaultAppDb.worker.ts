import { expose, proxy } from 'comlink';
import {
  ApplyChangesService,
  DbChangesWriterService,
} from '../db/sync/persistence/ApplyChangesService';
import { BaseDbSyncWorker } from '../db/sync/persistence/BaseDbSyncWorker';
import { BlocksScopesRepository } from './NoteBlock/repositories/BlockScopesRepository';
import { SqlNotesBlocksRepository } from './NoteBlock/repositories/NotesBlocksRepository';
import { SqlNotesRepository } from './NotesTree/repositories/NotesRepository';
import { VaultChangesApplier } from './services/sync/VaultChangesApplier/VaultChangesApplier';
import { FindNoteOrBlockService } from './services/FindNoteOrBlockService';
import { ImportExportService } from './services/ImportExportService';
import { DeleteNoteService } from './Note/services/DeleteNoteService';
import { IMigration } from '../db/core/types';
import { initSyncTables } from '../apps-migrations/initSyncTables';
import { initVaultsTables } from '../apps-migrations/initVaultsTables';
import { addBlockIdsToNoteBlocksTables } from '../apps-migrations/addBlockIdsToNoteBlocksTable';

export class VaultAppDbWorker extends BaseDbSyncWorker {
  getNotesRepo() {
    return proxy(this.getNotesRepoWithoutProxy());
  }

  getNotesBlocksRepo() {
    return proxy(this.getNoteBlocksRepoWithoutProxy());
  }

  getBlocksViewsRepo() {
    return proxy(this.getBlocksViewRepoWithoutProxy());
  }
  getFindService() {
    return proxy(new FindNoteOrBlockService(this.db));
  }

  getImportExportService() {
    return proxy(
      new ImportExportService(
        this.getNotesRepoWithoutProxy(),
        this.getNoteBlocksRepoWithoutProxy(),
        this.getBlocksViewRepoWithoutProxy(),
      ),
    );
  }

  getDeleteNoteService() {
    return proxy(
      new DeleteNoteService(
        this.getNotesRepoWithoutProxy(),
        this.getNoteBlocksRepoWithoutProxy(),
      ),
    );
  }

  private getBlocksViewRepoWithoutProxy() {
    return new BlocksScopesRepository(this.syncRepo, this.db, this.windowId);
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
          this.getBlocksViewRepoWithoutProxy(),
          new DbChangesWriterService(),
        ),
        this.syncRepo,
      ),
    );
  }

  migrations(): IMigration[] {
    return [initSyncTables, initVaultsTables, addBlockIdsToNoteBlocksTables];
  }
}

expose(VaultAppDbWorker);