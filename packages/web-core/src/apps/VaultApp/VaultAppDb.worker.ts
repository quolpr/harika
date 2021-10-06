import { expose, proxy } from 'comlink';
import {
  ApplyChangesService,
  DbChangesWriterService,
} from '../../extensions/SyncExtension/persistence/ApplyChangesService';
import { BaseDbSyncWorker } from '../../extensions/SyncExtension/persistence/BaseDbSyncWorker';
import { BlocksScopesRepository } from '../../newApps/VaultApplication/NoteBlocksExtension/repositories/BlockScopesRepository';
import { NotesBlocksRepository } from '../../newApps/VaultApplication/NoteBlocksExtension/repositories/NotesBlocksRepository';
import { SqlNotesRepository } from './NotesApp/repositories/NotesRepository';
import { VaultChangesApplier } from './services/sync/VaultChangesApplier/VaultChangesApplier';
import { FindNoteOrBlockService } from './services/FindNoteOrBlockService';
import { ImportExportService } from './services/ImportExportService';
import { DeleteNoteService } from './NotesApp/services/DeleteNoteService';
import { IMigration } from '../../extensions/DbExtension/types';
import { initSyncTables } from '../../extensions/SyncExtension/migrations/initSyncTables';
import { initNoteBlocksTables } from '../../newApps/VaultApplication/NoteBlocksExtension/migrations/initNoteBlocksTables';
import { addBlockIdsToNoteBlocksTables } from '../../newApps/VaultApplication/NoteBlocksExtension/migrations/addBlockIdsToNoteBlocksTable';

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
    return new NotesBlocksRepository(this.syncRepo, this.db, this.windowId);
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
    return [initSyncTables, initNoteBlocksTables, addBlockIdsToNoteBlocksTables];
  }
}

expose(VaultAppDbWorker);
