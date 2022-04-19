import { injectable } from 'inversify';

import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { APPLICATION_ID } from '../../../framework/types';
import { addShouldBeDeletedToAttachments } from './migrations/addShouldBeDeleted';
import { createAttachmentsRelationsTable } from './migrations/createAttachemntsBlocksRelationsTable';
import { createAttachmentsTable } from './migrations/createAttachmentsTable';
import { AttachmentsBlocksRelationsRepository } from './repositories/AttachmentsBlocksRelationsRepository';
import { AttachmentsRepository } from './repositories/AttachmentsRepository';
import { DownloaderService } from './services/DownloaderService';
import { RelationUpdaterService } from './services/RelationUpdaterService';
import { UploaderService } from './services/UploaderService';
import { UploadFileService } from './services/UploadFileService';
import { UploadsDB } from './UploadsDb';

@injectable()
export class StorageAppExtension extends BaseSyncExtension {
  repos() {
    return [
      { repo: AttachmentsRepository, withSync: true },
      { repo: AttachmentsBlocksRelationsRepository, withSync: true },
    ];
  }

  async register() {
    await super.register();

    this.container.bind(UploadFileService).toSelf();
    this.container.bind(UploaderService).toSelf();
    this.container.bind(DownloaderService).toSelf();
    this.container.bind(RelationUpdaterService).toSelf();
    this.container.bind(UploadsDB).toDynamicValue(() => {
      return new UploadsDB(this.container.get(APPLICATION_ID));
    });
  }

  async initialize() {
    this.container.get(UploaderService).start();
    this.container.get(DownloaderService).start();
    this.container.get(RelationUpdaterService).start();
  }

  migrations() {
    return [
      createAttachmentsTable,
      addShouldBeDeletedToAttachments,
      createAttachmentsRelationsTable,
    ];
  }
}
