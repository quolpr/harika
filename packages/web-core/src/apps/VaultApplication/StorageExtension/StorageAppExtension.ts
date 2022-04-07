import { injectable } from 'inversify';

import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { createFileUploadsTable } from './migrations/createFileUploadsTable';
import { FileUploadsRepository } from './repositories/FileUploadRepository';
import { UploadFileService } from './services/UploadFileService';
import { UploadsDB } from './UploadsDb';

@injectable()
export class StorageAppExtension extends BaseSyncExtension {
  repos() {
    return [{ repo: FileUploadsRepository, withSync: true }];
  }

  async register() {
    await super.register();

    this.container.bind(UploadFileService).toSelf();
    this.container.bind(UploadsDB).toDynamicValue(() => {
      return new UploadsDB();
    });
  }

  migrations() {
    return [createFileUploadsTable];
  }
}
