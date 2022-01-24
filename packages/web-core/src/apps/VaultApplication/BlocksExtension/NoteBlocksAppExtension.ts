import { BlocksScopeStore } from './models/BlocksScopeStore';
import { BlocksScopesService } from './services/BlocksScopeService';
import { addBlockScopeTable } from './migrations/addBlockScopeTable';
import { BlocksScope } from './models/BlocksScope';
import { injectable } from 'inversify';
import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { SyncConfig } from '../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { blocksScopesMapper } from './mappers/blockScopesMapper';
import { BlocksScopesRepository } from './repositories/BlockScopesRepository';
import { NoteBlocksService } from './services/NoteBlocksService';
import { NoteBlocksRepository } from './repositories/NoteBlocksRepostitory';
import { TextBlocksRepository } from './repositories/TextBlocksRepository';
import { createBlocksChildrenTable } from './migrations/createBlocksChildrenTable';
import { createBlocksLinksTable } from './migrations/createBlocksLinksTable';
import { createNoteBlocksTable } from './migrations/createNoteBlocksTable';
import { createTextBlocksTable } from './migrations/createTextBlocksTable';
import { BlocksStore } from './models/BlocksStore';
import { noteBlockMapper } from './mappers/noteBlockMapper';
import { textBlockMapper } from './mappers/textBlockMappter';
import { TextBlocksService } from './services/TextBlocksService';
import { BLOCK_REPOSITORY } from './types';
import { NoteBlock } from './models/NoteBlock';
import { TextBlock } from './models/TextBlock';
import { AllBlocksService } from './services/AllBlocksService';
import { DeleteNoteService } from './services/DeleteNoteService';
import { FindNoteOrBlockService } from './services/FindNoteOrBlockService';
import { ImportExportService } from './services/ImportExportService';
import { UpdateLinksService } from './services/UpdateLinksService';
import { UpdateNoteTitleService } from './services/UpdateNoteTitleService';

@injectable()
export class NoteBlocksAppExtension extends BaseSyncExtension {
  async register() {
    await super.register();

    const scopeStore = new BlocksScopeStore({});

    this.container.bind(BlocksScopeStore).toConstantValue(scopeStore);
    this.container.bind(BlocksScopesService).toSelf();

    const blocksStore = new BlocksStore({});
    this.container.bind(BlocksStore).toConstantValue(blocksStore);
    this.container.bind(TextBlocksService).toSelf();
    this.container.bind(NoteBlocksService).toSelf();

    this.container.bind(AllBlocksService).toSelf();
    this.container.bind(DeleteNoteService).toSelf();
    this.container.bind(FindNoteOrBlockService).toSelf();
    this.container.bind(ImportExportService).toSelf();
    this.container.bind(UpdateLinksService).toSelf();
    this.container.bind(UpdateNoteTitleService).toSelf();

    this.container.bind(BLOCK_REPOSITORY).toConstantValue(scopeStore);
    this.container.bind(BLOCK_REPOSITORY).toConstantValue(blocksStore);
  }

  async initialize() {
    const scopesStore = this.container.get(BlocksScopeStore);
    const blocksStore = this.container.get(BlocksStore);
    const syncConfig = this.container.get(SyncConfig);

    const disposes: (() => void)[] = [];

    disposes.push(
      syncConfig.registerSyncRepo(noteBlockMapper, NoteBlocksRepository),
      syncConfig.registerSyncRepo(textBlockMapper, TextBlocksRepository),
      syncConfig.registerSyncRepo(blocksScopesMapper, BlocksScopesRepository),
    );

    disposes.push(
      syncConfig.onModelChange([NoteBlock, TextBlock], (attrs, deletedIds) => {
        blocksStore.handleModelChanges(attrs.flat(), deletedIds.flat());
      }),
    );

    disposes.push(
      syncConfig.onModelChange([BlocksScope], (attrs, deletedIds) => {
        const [scopeAttrs] = attrs;

        scopesStore.handleModelChanges(scopeAttrs, deletedIds.flat());
      }),
    );

    return () => {
      disposes.forEach((d) => d());
    };
  }

  async onReady() {}

  repos() {
    return [
      { repo: BlocksScopesRepository, withSync: true },
      { repo: NoteBlocksRepository, withSync: true },
      { repo: TextBlocksRepository, withSync: true },
    ];
  }

  migrations() {
    return [
      addBlockScopeTable,
      createBlocksChildrenTable,
      createBlocksLinksTable,
      createNoteBlocksTable,
      createTextBlocksTable,
    ];
  }
}
