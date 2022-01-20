import { injectable } from 'inversify';
import { NoteBlocksExtensionStore } from '../NoteBlocksExtension/models/NoteBlocksExtensionStore';
import { NotesBlocksRepository } from '../NoteBlocksExtension/repositories/NotesBlocksRepository';
import { BlocksScopesRepository } from './repositories/BlockScopesRepository';
import { blocksScopesMapper } from './mappers/blockScopesMapper';
import { blocksTreeDescriptorsMapper } from '../NoteBlocksExtension/mappers/blocksTreeDescriptorsMapper';
import { noteBlocksMapper } from '../NoteBlocksExtension/mappers/noteBlocksMapper';
import { BlocksTreeDescriptorsRepository } from '../NoteBlocksExtension/repositories/BlockTreeDescriptorsRepository';
import { SyncConfig } from '../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { NoteBlockModel } from '../NoteBlocksExtension/models/NoteBlockModel';
import { BlocksTreeDescriptor } from '../NoteBlocksExtension/models/BlocksTreeDescriptor';
import { NoteBlocksService } from '../NoteBlocksExtension/services/NoteBlocksService';
import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { initNoteBlocksTables } from '../NoteBlocksExtension/migrations/initNoteBlocksTables';
import { addBlockIdsToNoteBlocksTables } from '../NoteBlocksExtension/migrations/addBlockIdsToNoteBlocksTable';
import { addBlocksTreeDescriptorsTable } from '../NoteBlocksExtension/migrations/addBlockTreeDescriptorTable';
import { BlocksScopeStore } from './models/BlocksScopeStore';
import { BlocksScopesService } from './services/BlocksScopeService';
import { addBlockScopeTable } from './migrations/addBlockScopeTable';
import { BlocksScope } from './models/BlocksScope';

@injectable()
export class NoteBlocksAppExtension extends BaseSyncExtension {
  async register() {
    await super.register();

    const store = new NoteBlocksExtensionStore({});

    this.container.bind(NoteBlocksExtensionStore).toConstantValue(store);
    this.container.bind(NoteBlocksService).toSelf();

    this.container
      .bind(BlocksScopeStore)
      .toConstantValue(new BlocksScopeStore({}));
    this.container.bind(BlocksScopesService).toSelf();
  }

  async initialize() {
    const scopesStore = this.container.get(BlocksScopeStore);
    const blocksStore = this.container.get(NoteBlocksExtensionStore);
    const syncConfig = this.container.get(SyncConfig);

    const disposes: (() => void)[] = [];

    disposes.push(
      syncConfig.registerSyncRepo(blocksScopesMapper, BlocksScopesRepository),
      syncConfig.registerSyncRepo(
        blocksTreeDescriptorsMapper,
        BlocksTreeDescriptorsRepository,
      ),
      syncConfig.registerSyncRepo(noteBlocksMapper, NotesBlocksRepository),
      syncConfig.registerSyncRepo(blocksScopesMapper, BlocksScopesRepository),
    );

    disposes.push(
      syncConfig.onModelChange(
        [BlocksTreeDescriptor, NoteBlockModel],
        (attrs, deletedIds) => {
          const [descriptorAttrs, blocksAttrs] = attrs;

          blocksStore.handleModelChanges(
            descriptorAttrs,
            blocksAttrs,
            deletedIds,
            false,
          );
        },
      ),
    );

    disposes.push(
      syncConfig.onModelChange([BlocksScope], (attrs, deletedIds) => {
        const [scopeAttrs] = attrs;

        scopesStore.handleModelChanges(scopeAttrs, deletedIds);
      }),
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
      { repo: BlocksScopesRepository, withSync: true, remote: true },
    ];
  }

  migrations() {
    return [
      initNoteBlocksTables,
      addBlockIdsToNoteBlocksTables,
      addBlocksTreeDescriptorsTable,
      addBlockScopeTable,
    ];
  }
}
