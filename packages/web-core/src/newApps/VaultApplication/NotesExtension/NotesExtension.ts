import { inject, injectable } from 'inversify';
import { registerRootStore } from 'mobx-keystone';
import { SYNC_CHANGES_APPLIER } from '../../../extensions/SyncExtension/types';
import { BaseExtension } from '../../../framework/BaseExtension';
import { RemoteRegister } from '../../../framework/RemoteRegister';
import { NotesStore } from './models/NotesStore';
import { NotesRepository } from './repositories/NotesRepository';
import { NotesService } from './services/NotesService';
import { NotesChangesApplier } from './sync/NotesChangesApplier';

@injectable()
export class NotesExtension extends BaseExtension {
  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {
    super();
  }

  async register() {
    const store = new NotesStore({});

    registerRootStore(store);

    this.container.bind(NotesStore).toConstantValue(store);
    this.container.bind(NotesService).toSelf();

    this.container.bind(SYNC_CHANGES_APPLIER).to(NotesChangesApplier);

    await this.remoteRegister.registerRemote(NotesRepository);
  }

  async onReady() {
    console.log(await this.remoteRegister.getRemote(NotesRepository).getAll());
    console.log(await this.container.get(NotesService).getNote('123'));
  }
}
