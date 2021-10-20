import { BaseWorkerExtension } from '../../../framework/BaseWorkerExtension';
import { DeleteNoteService } from './worker/services/DeleteNoteService';
import { FindNoteOrBlockService } from './worker/services/FindNoteOrBlockService';
import { ImportExportService } from './worker/services/ImportExportService';

export default class VaultWorkerExtension extends BaseWorkerExtension {
  async register() {
    this.container.bind(DeleteNoteService).toSelf();
    this.container.bind(FindNoteOrBlockService).toSelf();
    this.container.bind(ImportExportService).toSelf();

    this.bindRemote(DeleteNoteService);
    this.bindRemote(FindNoteOrBlockService);
    this.bindRemote(ImportExportService);
  }
}
