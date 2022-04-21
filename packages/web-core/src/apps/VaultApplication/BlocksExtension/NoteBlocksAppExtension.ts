import { injectable } from 'inversify';

import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { SyncConfig } from '../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { SYNC_CONFLICT_RESOLVER } from '../../../extensions/SyncExtension/types';
import { blocksScopesMapper } from './mappers/blockScopesMapper';
import { noteBlockMapper } from './mappers/noteBlockMapper';
import { textBlockMapper } from './mappers/textBlockMappter';
import { addBlockScopeTable } from './migrations/addBlockScopeTable';
import { createBlocksChildrenTable } from './migrations/createBlocksChildrenTable';
import { createNoteBlocksTable } from './migrations/createNoteBlocksTable';
import { createTextBlocksTable } from './migrations/createTextBlocksTable';
import { BlocksScope } from './models/BlocksScope';
import { BlocksScopeStore } from './models/BlocksScopeStore';
import { BlocksStore } from './models/BlocksStore';
import { NoteBlock } from './models/NoteBlock';
import { TextBlock } from './models/TextBlock';
import { AllBlocksQueries } from './repositories/AllBlocksQueries';
import { AllBlocksRepository } from './repositories/AllBlocksRepository';
import { BlocksScopesRepository } from './repositories/BlockScopesRepository';
import { NoteBlocksRepository } from './repositories/NoteBlocksRepostitory';
import { TextBlocksRepository } from './repositories/TextBlocksRepository';
import { AllBlocksService } from './services/AllBlocksService';
import { BlocksScopesService } from './services/BlocksScopeService';
import { DeleteNoteService } from './services/DeleteNoteService';
import { DuplicatedNotesConflictResolver } from './services/DuplicatedNotesConflictResolver';
import { FindNoteOrBlockService } from './services/FindNoteOrBlockService';
import { ImportExportService } from './services/ImportExportService';
import { NoteBlocksService } from './services/NoteBlocksService';
import { TextBlocksService } from './services/TextBlocksService';
import { UpdateNoteTitleService } from './services/UpdateNoteTitleService';
import { BLOCK_REPOSITORY } from './types';

@injectable()
export class NoteBlocksAppExtension extends BaseSyncExtension {
  async register() {
    await super.register();

    this.container
      .bind(AllBlocksQueries)
      .toConstantValue(new AllBlocksQueries());

    const scopeStore = new BlocksScopeStore({});

    this.container.bind(BlocksScopeStore).toConstantValue(scopeStore);
    this.container.bind(BlocksScopesService).toSelf();

    const blocksStore = new BlocksStore({});
    this.container.bind(BlocksStore).toConstantValue(blocksStore);
    this.container.bind(TextBlocksService).toSelf();
    this.container.bind(NoteBlocksService).toSelf();

    this.container.bind(AllBlocksRepository).toSelf();
    this.container.bind(AllBlocksService).toSelf();
    this.container.bind(DeleteNoteService).toSelf();
    this.container.bind(FindNoteOrBlockService).toSelf();
    this.container.bind(ImportExportService).toSelf();
    this.container.bind(UpdateNoteTitleService).toSelf();

    this.container
      .bind(BLOCK_REPOSITORY)
      .toConstantValue(this.container.get(NoteBlocksRepository));
    this.container
      .bind(BLOCK_REPOSITORY)
      .toConstantValue(this.container.get(TextBlocksRepository));

    this.container
      .bind(SYNC_CONFLICT_RESOLVER)
      .to(DuplicatedNotesConflictResolver);
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
      syncConfig.onModelChange(
        [NoteBlock, TextBlock],
        ([noteBlocks, textBlocks], deletedIds) => {
          blocksStore.handleModelChanges(
            [
              { klass: NoteBlock, datas: noteBlocks },
              { klass: TextBlock, datas: textBlocks },
            ],
            deletedIds.flat(),
          );
        },
      ),
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
      createNoteBlocksTable,
      createTextBlocksTable,
    ];
  }
}
