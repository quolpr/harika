import { inject, injectable } from 'inversify';
import { registerRootStore } from 'mobx-keystone';
import { BaseExtension } from '../../../framework/BaseExtension';
import { RemoteRegister } from '../../../framework/RemoteRegister';
import { NoteBlocksExtensionStore } from './models/NoteBlocksExtensionStore';
import { NotesBlocksRepository } from './repositories/NotesBlocksRepository';
import { BlocksScopesRepository } from './repositories/BlockScopesRepository';
import { SYNC_MAPPER } from '../../../extensions/SyncExtension/mappers';
import { blocksScopesMapper } from './mappers/blockScopesMapper';
import { blocksTreeDescriptorsMapper } from './mappers/blocksTreeDescriptorsMapper';
import { noteBlocksMapper } from './mappers/noteBlocksMapper';

@injectable()
export class NoteBlocksExtension extends BaseExtension {
  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {
    super();
  }

  async register() {
    const store = new NoteBlocksExtensionStore({});

    registerRootStore(store);

    this.container.bind(NoteBlocksExtensionStore).toConstantValue(store);

    await this.remoteRegister.registerRemote(NotesBlocksRepository);
    await this.remoteRegister.registerRemote(BlocksScopesRepository);

    this.container.bind(SYNC_MAPPER).toConstantValue(blocksScopesMapper);
    this.container
      .bind(SYNC_MAPPER)
      .toConstantValue(blocksTreeDescriptorsMapper);
    this.container.bind(SYNC_MAPPER).toConstantValue(noteBlocksMapper);
  }

  async onReady() {
    console.log(
      await this.remoteRegister.getRemote(NotesBlocksRepository).getAll(),
    );
  }
}
