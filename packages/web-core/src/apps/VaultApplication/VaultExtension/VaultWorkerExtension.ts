import { BaseExtension } from '../../../framework/BaseExtension';
import { toRemoteName } from '../../../framework/utils';
import { DeleteNoteService } from './worker/services/DeleteNoteService';
import { FindNoteOrBlockService } from './worker/services/FindNoteOrBlockService';
import { ImportExportService } from './worker/services/ImportExportService';

export default class VaultWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(DeleteNoteService).toSelf();
    this.container.bind(FindNoteOrBlockService).toSelf();
    this.container.bind(ImportExportService).toSelf();

    this.container
      .bind(toRemoteName(DeleteNoteService))
      .toDynamicValue(() => this.container.get(DeleteNoteService));

    this.container
      .bind(toRemoteName(FindNoteOrBlockService))
      .toDynamicValue(() => this.container.get(FindNoteOrBlockService));

    this.container
      .bind(toRemoteName(ImportExportService))
      .toDynamicValue(() => this.container.get(ImportExportService));
  }
}
