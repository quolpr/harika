import { injectable } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { ImportExportService } from './services/ImportExportService';

@injectable()
export class ImportExportAppExtension extends BaseExtension {
  async register() {
    this.container.bind(ImportExportService).toSelf();
  }
}
