import { injectable } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { DeleteNoteService } from './services/DeleteNoteService';
import { FindNoteOrBlockService } from './services/FindNoteOrBlockService';
import { ImportExportService } from './services/ImportExportService';
import { VaultService } from './services/VaultService';

@injectable()
export class VaultAppExtension extends BaseExtension {
  async register() {
    this.container.bind(VaultService).toSelf();

    this.container.bind(DeleteNoteService).toSelf();
    this.container.bind(FindNoteOrBlockService).toSelf();
    this.container.bind(ImportExportService).toSelf();
  }
}
