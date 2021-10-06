import { inject, injectable } from 'inversify';
import { registerRootStore } from 'mobx-keystone';
import { SYNC_CHANGES_APPLIER } from '../../../extensions/SyncExtension/types';
import { BaseExtension } from '../../../framework/BaseExtension';
import { RemoteRegister } from '../../../framework/RemoteRegister';
import {NoteBlocksExtensionStore} from "./models/NoteBlocksExtensionStore";
import {BlocksScopesChangesApplier} from "./sync/BlocksScopesChangesApplier";
import {NoteblocksChangesApplier} from "./sync/NoteblocksChangesApplier";
import {NotesBlocksRepository} from "./repositories/NotesBlocksRepository";
import {BlocksScopesRepository} from "./repositories/BlockScopesRepository";

@injectable()
export class NoteBlocksExtension extends BaseExtension {
  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {
    super();
  }

  async register() {
    const store = new NoteBlocksExtensionStore({});

    registerRootStore(store);

    this.container.bind(NoteBlocksExtensionStore).toConstantValue(store);

    this.container.bind(SYNC_CHANGES_APPLIER).to(BlocksScopesChangesApplier);
    this.container.bind(SYNC_CHANGES_APPLIER).to(NoteblocksChangesApplier);

    await this.remoteRegister.registerRemote(NotesBlocksRepository);
    await this.remoteRegister.registerRemote(BlocksScopesRepository);
  }

  async onReady() {
    console.log(await this.remoteRegister.getRemote(NotesBlocksRepository).getAll());
  }
}
