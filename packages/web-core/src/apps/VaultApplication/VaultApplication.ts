import { registerRootStore } from 'mobx-keystone';
import { BehaviorSubject } from 'rxjs';

import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { DB_NAME } from '../../extensions/DbExtension/types';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { SyncStateService } from '../../extensions/SyncExtension/SyncState';
import {
  ISyncConfig,
  ROOT_STORE,
  SYNC_CONFIG,
  SYNC_CONNECTION_ALLOWED,
} from '../../extensions/SyncExtension/types';
import { BaseApplication } from '../../framework/BaseApplication';
import { VaultAppRootStore } from './AppRootStore';
import { BlockLinksAppExtension } from './BlockLinksExtension/BlockLinksAppExtension';
import { BlockLinksStore } from './BlockLinksExtension/models/BlockLinkStore';
import { BlockLinkService } from './BlockLinksExtension/services/BlockLinkService';
import { BlockScopesAppExtension } from './BlockScopesExtension/BlockScopesAppExtension';
import { BlocksScopeStore } from './BlockScopesExtension/models/BlocksScopeStore';
import { BlocksScopesService } from './BlockScopesExtension/services/BlocksScopeService';
import { BlocksStore } from './BlocksExtension/models/BlocksStore';
import { NoteBlocksAppExtension } from './BlocksExtension/NoteBlocksAppExtension';
import { AllBlocksService } from './BlocksExtension/services/AllBlocksService';
import { DeleteNoteService } from './BlocksExtension/services/DeleteNoteService';
import { FindNoteOrBlockService } from './BlocksExtension/services/FindNoteOrBlockService';
import { NoteBlocksService } from './BlocksExtension/services/NoteBlocksService';
import { TextBlocksService } from './BlocksExtension/services/TextBlocksService';
import { UpdateNoteTitleService } from './BlocksExtension/services/UpdateNoteTitleService';
import { ImportExportAppExtension } from './ImportExportExtension/ImportExportAppExtension';
import { ImportExportService } from './ImportExportExtension/services/ImportExportService';
import { NotesTreeRegistry } from './NotesTreeExtension/models/NotesTreeRegistry';
import { NotesTreeAppExtension } from './NotesTreeExtension/NotesTreeAppExtension';
import { SpacedRepetitionExtension } from './SpacedRepetitionExtension/SpacedRepetitionExtension';
import { UploadFileService } from './StorageExtension/services/UploadFileService';
import { StorageAppExtension } from './StorageExtension/StorageAppExtension';

export class VaultApplication extends BaseApplication {
  constructor(applicationId: string, private syncConfig: ISyncConfig) {
    super(applicationId);
  }

  get applicationName() {
    return 'vault';
  }

  get extensions() {
    return [
      DbAppExtension,
      SyncAppExtension,
      BlockLinksAppExtension,
      NoteBlocksAppExtension,
      NotesTreeAppExtension,
      SpacedRepetitionExtension,
      BlockScopesAppExtension,
      StorageAppExtension,
      ImportExportAppExtension,
    ];
  }

  async register() {
    const rootStore = new VaultAppRootStore({} as any);
    this.container.bind(VaultAppRootStore).toConstantValue(rootStore);
    registerRootStore(rootStore);

    this.container.bind(ROOT_STORE).toConstantValue(rootStore);
    this.container.bind(SYNC_CONFIG).toConstantValue(this.syncConfig);
  }

  async initialize() {
    const blocksScopeStore = this.container.get(BlocksScopeStore);
    const blocksStore = this.container.get(BlocksStore);
    const blockLinkStore = this.container.get(BlockLinksStore);

    this.container
      .get(VaultAppRootStore)
      .setStores(blocksStore, blocksScopeStore, blockLinkStore);
  }

  getBlocksScopesService() {
    return this.container.get(BlocksScopesService);
  }

  getBlocksScopesStore() {
    return this.container.get(BlocksScopeStore);
  }

  getRootStore() {
    return this.container.get(VaultAppRootStore);
  }

  getNoteBlocksService() {
    return this.container.get(NoteBlocksService);
  }

  getNotesTreeRegistry() {
    return this.container.get(NotesTreeRegistry);
  }

  getAllBlocksService() {
    return this.container.get(AllBlocksService);
  }

  getUpdateNoteTitleService() {
    return this.container.get(UpdateNoteTitleService);
  }

  getTextBlocksService() {
    return this.container.get(TextBlocksService);
  }

  getUploadService() {
    return this.container.get(UploadFileService);
  }

  getFindService() {
    return this.container.get(FindNoteOrBlockService);
  }

  getDeleteNoteService() {
    return this.container.get(DeleteNoteService);
  }

  getImportExportService() {
    return this.container.get(ImportExportService);
  }

  getBlockLinkService() {
    return this.container.get(BlockLinkService);
  }

  getBlockLinkStore() {
    return this.container.get(BlockLinksStore);
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
}
