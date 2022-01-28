import { BaseApplication } from '../../framework/BaseApplication';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { NoteBlocksAppExtension } from './BlocksExtension/NoteBlocksAppExtension';
import { NotesTreeAppExtension } from './NotesTreeExtension/NotesTreeAppExtension';
import { SpacedRepetitionExtension } from './SpacedRepetitionExtension/SpacedRepetitionExtension';
import { NotesTreeRegistry } from './NotesTreeExtension/models/NotesTreeRegistry';
import { DB_NAME } from '../../extensions/DbExtension/types';
import { VaultAppRootStore } from './AppRootStore';
import { BlocksScopesService } from './BlocksExtension/services/BlocksScopeService';
import { registerRootStore } from 'mobx-keystone';
import { BlocksScopeStore } from './BlocksExtension/models/BlocksScopeStore';
import {
  GET_AUTH_TOKEN,
  ROOT_STORE,
  SYNC_CONNECTION_ALLOWED,
  SYNC_URL,
} from '../../extensions/SyncExtension/types';
import { SyncStateService } from '../../extensions/SyncExtension/SyncState';
import { BehaviorSubject } from 'rxjs';
import { BlocksStore } from './BlocksExtension/models/BlocksStore';
import { NoteBlocksService } from './BlocksExtension/services/NoteBlocksService';
import { TextBlocksService } from './BlocksExtension/services/TextBlocksService';
import { FindNoteOrBlockService } from './BlocksExtension/services/FindNoteOrBlockService';
import { DeleteNoteService } from './BlocksExtension/services/DeleteNoteService';
import { ImportExportService } from './BlocksExtension/services/ImportExportService';
import { AllBlocksService } from './BlocksExtension/services/AllBlocksService';
import { UpdateLinksService } from './BlocksExtension/services/UpdateLinksService';
import { UpdateNoteTitleService } from './BlocksExtension/services/UpdateNoteTitleService';

export class VaultApplication extends BaseApplication {
  constructor(
    applicationId: string,
    private syncUrl: string,
    private getAuthToken: () => Promise<string | undefined>,
  ) {
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
    ];
  }

  async initialize() {
    const blocksScopeStore = this.container.get(BlocksScopeStore);
    const blocksStore = this.container.get(BlocksStore);

    const rootStore = new VaultAppRootStore({
      blocksStore,
      blocksScopeStore,
    });

    this.container.bind(VaultAppRootStore).toConstantValue(rootStore);
    this.container.bind(ROOT_STORE).toConstantValue(rootStore);
    this.container.bind(SYNC_URL).toConstantValue(this.syncUrl);
    this.container.bind(GET_AUTH_TOKEN).toConstantValue(this.getAuthToken);

    registerRootStore(rootStore);
  }

  getBlocksScopesService() {
    return this.container.get(BlocksScopesService);
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

  getFindService() {
    return this.container.get(FindNoteOrBlockService);
  }

  getDeleteNoteService() {
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
}
