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
import { DB_NAME } from '../../extensions/DbExtension/types';
import { VaultAppRootStore } from './AppRootStore';
import { BlocksScopeExtension } from './BlocksScopeExtension/BlocksScopeExtension';
import { BlocksScopesService } from './BlocksScopeExtension/services/BlocksScopeService';
import { NotesStore } from './NotesExtension/models/NotesStore';
import { registerRootStore } from 'mobx-keystone';
import { BlocksScopeStore } from './BlocksScopeExtension/models/BlocksScopeStore';
import { NoteBlocksExtensionStore } from './NoteBlocksExtension/models/NoteBlocksExtensionStore';

export class VaultApplication extends BaseApplication {
  constructor(applicationId: string, public vaultName: string) {
    super(applicationId);
  }

  async initialize() {
    const notesStore = this.container.get(NotesStore);
    const blocksScopeStore = this.container.get(BlocksScopeStore);
    const noteBlocksStore = this.container.get(NoteBlocksExtensionStore);

    const rootStore = new VaultAppRootStore({
      notesStore,
      blocksScopeStore,
      noteBlocksStore,
    });

    this.container.bind(VaultAppRootStore).toConstantValue(rootStore);

    registerRootStore(rootStore);
  }

  getBlocksScopesService() {
    return this.container.get(BlocksScopesService);
  }

  getRootStore() {
    return this.container.get(VaultAppRootStore);
  }

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

  getDbName() {
    return this.container.get<string>(DB_NAME);
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
      BlocksScopeExtension,
    ];
  }
}
