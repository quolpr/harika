import { inject, injectable } from 'inversify';
import { registerRootStore } from 'mobx-keystone';
import { BaseExtension } from '../../../framework/BaseExtension';
import { RemoteRegister } from '../../../framework/RemoteRegister';
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

@injectable()
export class NoteBlocksExtension extends BaseExtension {
  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {
    super();
  }

  async register() {
    const store = new NoteBlocksExtensionStore({});

    registerRootStore(store);

    this.container.bind(NoteBlocksExtensionStore).toConstantValue(store);
    this.container.bind(NoteBlocksService).toSelf();

    await this.remoteRegister.registerRemote(NotesBlocksRepository);
    await this.remoteRegister.registerRemote(BlocksTreeDescriptorsRepository);
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

  async onReady() {
    console.log(
      await this.remoteRegister.getRemote(NotesBlocksRepository).getAll(),
    );
  }
}
