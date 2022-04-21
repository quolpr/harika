import { injectable } from 'inversify';

import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { SyncConfig } from '../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { SYNC_CONFLICT_RESOLVER } from '../../../extensions/SyncExtension/types';
import { noteBlockMapper } from './mappers/noteBlockMapper';
import { textBlockMapper } from './mappers/textBlockMappter';
import { createBlocksChildrenTable } from './migrations/createBlocksChildrenTable';
import { createNoteBlocksTable } from './migrations/createNoteBlocksTable';
import { createTextBlocksTable } from './migrations/createTextBlocksTable';
import { BlocksStore } from './models/BlocksStore';
import { NoteBlock } from './models/NoteBlock';
import { TextBlock } from './models/TextBlock';
import { AllBlocksQueries } from './repositories/AllBlocksQueries';
import { AllBlocksRepository } from './repositories/AllBlocksRepository';
import { NoteBlocksRepository } from './repositories/NoteBlocksRepostitory';
import { TextBlocksRepository } from './repositories/TextBlocksRepository';
import { AllBlocksService } from './services/AllBlocksService';
import { DeleteNoteService } from './services/DeleteNoteService';
import { DuplicatedNotesConflictResolver } from './services/DuplicatedNotesConflictResolver';
import { FindNoteOrBlockService } from './services/FindNoteOrBlockService';
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

    const blocksStore = new BlocksStore({});
    this.container.bind(BlocksStore).toConstantValue(blocksStore);
    this.container.bind(TextBlocksService).toSelf();
    this.container.bind(NoteBlocksService).toSelf();

    this.container.bind(AllBlocksRepository).toSelf();
    this.container.bind(AllBlocksService).toSelf();
    this.container.bind(DeleteNoteService).toSelf();
    this.container.bind(FindNoteOrBlockService).toSelf();
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
    const blocksStore = this.container.get(BlocksStore);
    const syncConfig = this.container.get(SyncConfig);

    const disposes: (() => void)[] = [];

    disposes.push(
      syncConfig.registerSyncRepo(noteBlockMapper, NoteBlocksRepository),
      syncConfig.registerSyncRepo(textBlockMapper, TextBlocksRepository),
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

    return () => {
      disposes.forEach((d) => d());
    };
  }

  async onReady() {}

  repos() {
    return [
      { repo: NoteBlocksRepository, withSync: true },
      { repo: TextBlocksRepository, withSync: true },
    ];
  }

  migrations() {
    return [
      createBlocksChildrenTable,
      createNoteBlocksTable,
      createTextBlocksTable,
    ];
  }
}
