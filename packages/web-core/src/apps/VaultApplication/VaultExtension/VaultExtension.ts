import { injectable, inject } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { RemoteRegister } from '../../../framework/RemoteRegister';
import { DeleteNoteService } from './services/DeleteNoteService';
import { FindNoteOrBlockService } from './services/FindNoteOrBlockService';
import { ImportExportService } from './services/ImportExportService';
import { VaultService } from './services/VaultService';

@injectable()
export class VaultExtension extends BaseExtension {
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
