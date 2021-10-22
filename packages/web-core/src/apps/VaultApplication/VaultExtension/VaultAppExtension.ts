import { injectable } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { DeleteNoteService } from './worker/services/DeleteNoteService';
import { FindNoteOrBlockService } from './worker/services/FindNoteOrBlockService';
import { ImportExportService } from './worker/services/ImportExportService';
import { VaultService } from './app/services/VaultService';

@injectable()
export class VaultAppExtension extends BaseExtension {
  async register() {
    this.container.bind(VaultService).toSelf();

    this.container.bind(DeleteNoteService).toSelf();
    this.container.bind(FindNoteOrBlockService).toSelf();
    this.container.bind(ImportExportService).toSelf();
  }
}
