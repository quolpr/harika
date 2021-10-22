import { BaseApplication } from '../../framework/BaseApplication';
import { NotesAppExtension } from './NotesExtension/NotesAppExtension';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { NoteBlocksAppExtension } from './NoteBlocksExtension/NoteBlocksAppExtension';
import { VaultAppExtension } from './VaultExtension/VaultAppExtension';
import { NotesTreeAppExtension } from './NotesTreeExtension/NotesTreeAppExtension';
import { SpacedRepetitionExtension } from './SpacedRepetitionExtension/SpacedRepetitionExtension';
import { VaultService } from './VaultExtension/app/services/VaultService';
import { NotesService } from './NotesExtension/app/services/NotesService';
import { NotesTreeRegistry } from './NotesTreeExtension/models/NotesTreeRegistry';
import { NoteBlocksService } from './NoteBlocksExtension/app/services/NoteBlocksService';
import { FindNoteOrBlockService } from './VaultExtension/worker/services/FindNoteOrBlockService';
import { DeleteNoteService } from './VaultExtension/worker/services/DeleteNoteService';
import { ImportExportService } from './VaultExtension/worker/services/ImportExportService';
import { DB_NAME } from '../../extensions/DbExtension/types';
import { VaultAppRootStore } from './AppRootStore';
import { BlocksScopeAppExtension } from './BlocksScopeExtension/BlocksScopeAppExtension';
import { BlocksScopesService } from './BlocksScopeExtension/app/services/BlocksScopeService';
import { NotesStore } from './NotesExtension/app/models/NotesStore';
import { registerRootStore } from 'mobx-keystone';
import { BlocksScopeStore } from './BlocksScopeExtension/app/models/BlocksScopeStore';
import { NoteBlocksExtensionStore } from './NoteBlocksExtension/app/models/NoteBlocksExtensionStore';
import {
  SYNC_AUTH_TOKEN,
  SYNC_CONNECTION_ALLOWED,
  SYNC_URL,
} from '../../extensions/SyncExtension/types';
import { SyncStateService } from '../../extensions/SyncExtension/app/SyncState';
import { BehaviorSubject } from 'rxjs';

export class VaultApplication extends BaseApplication {
  constructor(
    applicationId: string,
    private syncConfig: {
      url: string;
      authToken: string;
    },
  ) {
    super(applicationId);
  }

  async register() {
    this.container.bind(SYNC_URL).toConstantValue(this.syncConfig.url);
    this.container
      .bind(SYNC_AUTH_TOKEN)
      .toConstantValue(this.syncConfig.authToken);
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
