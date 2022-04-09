import { injectable } from 'inversify';

import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { DownloaderService } from './services/DownloaderService';
import { UploaderService } from './services/UploaderService';
import { UploadFileService } from './services/UploadFileService';
import { UploadsDB } from './UploadsDb';
import { AttachmentsRepository } from './repositories/AttachmentsRepository';
import { createAttachmentsTable } from './migrations/createAttachmentsTable';

@injectable()
export class StorageAppExtension extends BaseSyncExtension {
  repos() {
    return [{ repo: AttachmentsRepository, withSync: true }];
  }

  async register() {
    await super.register();

    this.container.bind(UploadFileService).toSelf();
    this.container.bind(UploaderService).toSelf();
    this.container.bind(DownloaderService).toSelf();
    this.container.bind(UploadsDB).toDynamicValue(() => {
      return new UploadsDB();
    });
  }

  async initialize() {
    this.container.get(UploaderService).start();
    this.container.get(DownloaderService).start();
  }

  migrations() {
    return [createAttachmentsTable];
  }
}
