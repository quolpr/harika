import { registerRootStore } from 'mobx-keystone';
import { BehaviorSubject } from 'rxjs';

import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { DB_NAME } from '../../extensions/DbExtension/types';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { SyncStateService } from '../../extensions/SyncExtension/SyncState';
import {
  ROOT_STORE,
  SYNC_CONNECTION_ALLOWED,
  SYNC_URL,
} from '../../extensions/SyncExtension/types';
import { BaseApplication } from '../../framework/BaseApplication';
import { VaultAppRootStore } from './AppRootStore';
import { BlockLinksStore } from './BlocksExtension/models/BlockLinkStore';
import { BlocksScopeStore } from './BlocksExtension/models/BlocksScopeStore';
import { BlocksStore } from './BlocksExtension/models/BlocksStore';
import { NoteBlocksAppExtension } from './BlocksExtension/NoteBlocksAppExtension';
import { AllBlocksService } from './BlocksExtension/services/AllBlocksService';
import { BlockLinkService } from './BlocksExtension/services/BlockLinkService';
import { BlocksScopesService } from './BlocksExtension/services/BlocksScopeService';
import { DeleteNoteService } from './BlocksExtension/services/DeleteNoteService';
import { FindNoteOrBlockService } from './BlocksExtension/services/FindNoteOrBlockService';
import { ImportExportService } from './BlocksExtension/services/ImportExportService';
import { NoteBlocksService } from './BlocksExtension/services/NoteBlocksService';
import { TextBlocksService } from './BlocksExtension/services/TextBlocksService';
import { UpdateLinksService } from './BlocksExtension/services/UpdateLinksService';
import { UpdateNoteTitleService } from './BlocksExtension/services/UpdateNoteTitleService';
import { NotesTreeRegistry } from './NotesTreeExtension/models/NotesTreeRegistry';
import { NotesTreeAppExtension } from './NotesTreeExtension/NotesTreeAppExtension';
import { SpacedRepetitionExtension } from './SpacedRepetitionExtension/SpacedRepetitionExtension';
import { UploadFileService } from './StorageExtension/services/UploadFileService';
import { StorageAppExtension } from './StorageExtension/StorageAppExtension';

export class VaultApplication extends BaseApplication {
  constructor(applicationId: string, private syncUrl: string) {
    super(applicationId);
  }

  get applicationName() {
    return 'vault';
  }

  get extensions() {
    return [
      DbAppExtension,
      SyncAppExtension,
      NoteBlocksAppExtension,
      NotesTreeAppExtension,
      SpacedRepetitionExtension,
      StorageAppExtension,
    ];
  }

  async register() {
    this.container.bind(SYNC_URL).toConstantValue(this.syncUrl);
  }

  async initialize() {
    const blocksScopeStore = this.container.get(BlocksScopeStore);
    const blocksStore = this.container.get(BlocksStore);
    const blockLinkStore = this.container.get(BlockLinksStore);

    const rootStore = new VaultAppRootStore({
      blocksStore,
      blocksScopeStore,
      blockLinkStore,
    });

    this.container.bind(VaultAppRootStore).toConstantValue(rootStore);
    this.container.bind(ROOT_STORE).toConstantValue(rootStore);

    registerRootStore(rootStore);
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

  getUpdateLinksService() {
    return this.container.get(UpdateLinksService);
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
