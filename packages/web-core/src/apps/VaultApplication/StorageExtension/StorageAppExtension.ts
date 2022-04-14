import { injectable } from 'inversify';

import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { APPLICATION_ID } from '../../../framework/types';
import { addShouldBeDeletedToAttachments } from './migrations/addShouldBeDeleted';
import { createAttachmentsTable } from './migrations/createAttachmentsTable';
import { AttachmentsRepository } from './repositories/AttachmentsRepository';
import { DeleteAttachmentsService } from './services/DeleteAttachmentsService';
import { DownloaderService } from './services/DownloaderService';
import { UploaderService } from './services/UploaderService';
import { UploadFileService } from './services/UploadFileService';
import { UploadsDB } from './UploadsDb';

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
      return new UploadsDB(this.container.get(APPLICATION_ID));
    });
  }

  async initialize() {
    this.container.get(UploaderService).start();
    this.container.get(DownloaderService).start();

    this.container.resolve(DeleteAttachmentsService);
  }

  migrations() {
    return [createAttachmentsTable, addShouldBeDeletedToAttachments];
  }
}
