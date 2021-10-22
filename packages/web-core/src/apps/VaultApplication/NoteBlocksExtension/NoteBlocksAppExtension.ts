import { inject, injectable } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { NoteBlocksExtensionStore } from './app/models/NoteBlocksExtensionStore';
import { NotesBlocksRepository } from './worker/repositories/NotesBlocksRepository';
import { BlocksScopesRepository } from '../BlocksScopeExtension/worker/repositories/BlockScopesRepository';
import { blocksScopesMapper } from '../BlocksScopeExtension/app/mappers/blockScopesMapper';
import { blocksTreeDescriptorsMapper } from './app/mappers/blocksTreeDescriptorsMapper';
import { noteBlocksMapper } from './app/mappers/noteBlocksMapper';
import { BlocksTreeDescriptorsRepository } from './worker/repositories/BlockTreeDescriptorsRepository';
import { SyncConfig } from '../../../extensions/SyncExtension/app/serverSynchronizer/SyncConfig';
import { NoteBlockModel } from './app/models/NoteBlockModel';
import { BlocksTreeDescriptor } from './app/models/BlocksTreeDescriptor';
import { NoteBlocksService } from './app/services/NoteBlocksService';
import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { initNoteBlocksTables } from './worker/migrations/initNoteBlocksTables';
import { addBlockIdsToNoteBlocksTables } from './worker/migrations/addBlockIdsToNoteBlocksTable';
import { addBlocksTreeDescriptorsTable } from './worker/migrations/addBlockTreeDescriptorTable';

@injectable()
export class NoteBlocksAppExtension extends BaseSyncExtension {
  async register() {
    await super.register();

    const store = new NoteBlocksExtensionStore({});

    this.container.bind(NoteBlocksExtensionStore).toConstantValue(store);
    this.container.bind(NoteBlocksService).toSelf();
  }

  async initialize() {
    const store = this.container.get(NoteBlocksExtensionStore);

    const syncConfig = this.container.get(SyncConfig);

    const disposes: (() => void)[] = [];

    disposes.push(
      syncConfig.registerSyncRepo(blocksScopesMapper, BlocksScopesRepository),
      syncConfig.registerSyncRepo(
        blocksTreeDescriptorsMapper,
        BlocksTreeDescriptorsRepository,
      ),
      syncConfig.registerSyncRepo(noteBlocksMapper, NotesBlocksRepository),
    );

    disposes.push(
      syncConfig.onModelChange(
        [BlocksTreeDescriptor, NoteBlockModel],
        (attrs, deletedIds) => {
          const [descriptorAttrs, blocksAttrs] = attrs;

          store.handleModelChanges(
            descriptorAttrs,
            blocksAttrs,
            deletedIds,
            false,
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
      { repo: NotesBlocksRepository, withSync: true },
      { repo: BlocksTreeDescriptorsRepository, withSync: true },
    ];
  }

  migrations() {
    return [
      initNoteBlocksTables,
      addBlockIdsToNoteBlocksTables,
      addBlocksTreeDescriptorsTable,
    ];
  }
}
