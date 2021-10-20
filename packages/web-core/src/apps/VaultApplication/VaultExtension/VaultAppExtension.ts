import { injectable, inject } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { RemoteRegister } from '../../../framework/RemoteRegister';
import { DeleteNoteService } from './worker/services/DeleteNoteService';
import { FindNoteOrBlockService } from './worker/services/FindNoteOrBlockService';
import { ImportExportService } from './worker/services/ImportExportService';
import { VaultService } from './app/services/VaultService';

@injectable()
export class VaultAppExtension extends BaseExtension {
  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {
    super();
  }

  async register() {
    this.container.bind(VaultService).toSelf();

    await this.remoteRegister.registerRemote(DeleteNoteService);
    await this.remoteRegister.registerRemote(FindNoteOrBlockService);
    await this.remoteRegister.registerRemote(ImportExportService);
  }
}
