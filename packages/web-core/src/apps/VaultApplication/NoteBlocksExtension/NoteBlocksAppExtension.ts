import { inject, injectable } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { NoteBlocksExtensionStore } from './models/NoteBlocksExtensionStore';
import { NotesBlocksRepository } from './repositories/NotesBlocksRepository';
import { BlocksScopesRepository } from '../BlocksScopeExtension/repositories/BlockScopesRepository';
import { blocksScopesMapper } from '../BlocksScopeExtension/mappers/blockScopesMapper';
import { blocksTreeDescriptorsMapper } from './mappers/blocksTreeDescriptorsMapper';
import { noteBlocksMapper } from './mappers/noteBlocksMapper';
import { BlocksTreeDescriptorsRepository } from './repositories/BlockTreeDescriptorsRepository';
import { SyncConfig } from '../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { NoteBlockModel } from './models/NoteBlockModel';
import { BlocksTreeDescriptor } from './models/BlocksTreeDescriptor';
import { NoteBlocksService } from './services/NoteBlocksService';
import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { initNoteBlocksTables } from './migrations/initNoteBlocksTables';
import { addBlockIdsToNoteBlocksTables } from './migrations/addBlockIdsToNoteBlocksTable';
import { addBlocksTreeDescriptorsTable } from './migrations/addBlockTreeDescriptorTable';

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
