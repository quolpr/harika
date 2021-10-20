import { injectable, inject } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { DeleteNoteService } from './worker/services/DeleteNoteService';
import { FindNoteOrBlockService } from './worker/services/FindNoteOrBlockService';
import { ImportExportService } from './worker/services/ImportExportService';
import { VaultService } from './app/services/VaultService';
import { BaseAppExtension } from '../../../framework/BaseAppExtension';

@injectable()
export class VaultAppExtension extends BaseAppExtension {
  async register() {
    this.container.bind(VaultService).toSelf();

    await this.bindRemote(DeleteNoteService);
    await this.bindRemote(FindNoteOrBlockService);
    await this.bindRemote(ImportExportService);
  }
}
