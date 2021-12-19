import { BaseApplication } from '../../framework/BaseApplication';
import { NotesAppExtension } from './NotesExtension/NotesAppExtension';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { NoteBlocksAppExtension } from './NoteBlocksExtension/NoteBlocksAppExtension';
import { VaultAppExtension } from './VaultExtension/VaultAppExtension';
import { NotesTreeAppExtension } from './NotesTreeExtension/NotesTreeAppExtension';
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
import { BlocksScopeAppExtension } from './BlocksScopeExtension/BlocksScopeAppExtension';
import { BlocksScopesService } from './BlocksScopeExtension/services/BlocksScopeService';
import { NotesStore } from './NotesExtension/models/NotesStore';
import { registerRootStore } from 'mobx-keystone';
import { BlocksScopeStore } from './BlocksScopeExtension/models/BlocksScopeStore';
import { NoteBlocksExtensionStore } from './NoteBlocksExtension/models/NoteBlocksExtensionStore';
import {
  ROOT_STORE,
  SYNC_CONNECTION_ALLOWED,
} from '../../extensions/SyncExtension/types';
import { SyncStateService } from '../../extensions/SyncExtension/SyncState';
import { BehaviorSubject } from 'rxjs';
import { SyncConnectionConfig } from '../../extensions/SyncExtension/SyncConnectionConfig';

export class VaultApplication extends BaseApplication {
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
    this.container.bind(ROOT_STORE).toConstantValue(rootStore);

    registerRootStore(rootStore);
  }

  setSyncConfig(syncConfig: { url: string; authToken: string }) {
    this.container.get(SyncConnectionConfig).config$.next(syncConfig);
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

  getSyncState$() {
    return this.container.get(SyncStateService).current$;
  }

  getIsConnectionAllowed$() {
    return this.container.get<BehaviorSubject<boolean>>(
      SYNC_CONNECTION_ALLOWED,
    );
  }

  get applicationName() {
    return 'vault';
  }

  get extensions() {
    return [
      DbAppExtension,
      SyncAppExtension,
      NotesAppExtension,
      NoteBlocksAppExtension,
      VaultAppExtension,
      NotesTreeAppExtension,
      SpacedRepetitionExtension,
      BlocksScopeAppExtension,
    ];
  }
}
