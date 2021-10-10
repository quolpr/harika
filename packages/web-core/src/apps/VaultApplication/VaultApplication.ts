import { BaseApplication } from '../../framework/BaseApplication';
import { NotesExtension } from './NotesExtension/NotesExtension';
// @ts-ignore
import VaultWorker from './VaultRootWorker?worker';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { NoteBlocksExtension } from './NoteBlocksExtension/NoteBlocksExtension';
import { VaultExtension } from './VaultExtension/VaultExtension';
import { NotesTreeExtension } from './NotesTreeExtension/NotesTreeExtension';
import { SpacedRepetitionExtension } from './SpacedRepetitionExtension/SpacedRepetitionExtension';
import { VaultService } from './VaultExtension/services/VaultService';
import { NotesService } from './NotesExtension/services/NotesService';
import { NotesTreeRegistry } from './NotesTreeExtension/models/NotesTreeRegistry';
import { NoteBlocksService } from './NoteBlocksExtension/services/NoteBlocksService';
import { FindNoteOrBlockService } from './VaultExtension/services/FindNoteOrBlockService';
import { DeleteNoteService } from './VaultExtension/services/DeleteNoteService';
import { ImportExportService } from './VaultExtension/services/ImportExportService';

export class VaultApplication extends BaseApplication {
  getVaultService() {
    return this.container.get(VaultService);
  }

  getNotesService() {
    return this.container.get(NotesService);
  }

  getNotesTreeRegistry() {
    return this.container.get(NotesTreeRegistry);
  }

  getNoteBlocksService() {
    return this.container.get(NoteBlocksService);
  }

  getFindService() {
    return this.container.get(FindNoteOrBlockService);
  }

  getDeleteService() {
    return this.container.get(DeleteNoteService);
  }

  getImportExportService() {
    return this.container.get(ImportExportService);
  }

  get applicationName() {
    return 'vault';
  }

  get workerClass() {
    return VaultWorker;
  }

  get extensions() {
    return [
      DbAppExtension,
      SyncAppExtension,
      NotesExtension,
      NoteBlocksExtension,
      VaultExtension,
      NotesTreeExtension,
      SpacedRepetitionExtension,
    ];
  }
}
