import { inject, injectable } from 'inversify';

import { FileUploadsRepository } from '../repositories/FileUploadRepository';
import { UploadsDB } from '../UploadsDb';

@injectable()
export class UploadFileService {
  constructor(
    @inject(UploadsDB) private uploadsDb: UploadsDB,
    @inject(FileUploadsRepository)
    private fileUploadsRepo: FileUploadsRepository,
  ) {}

  async createUploads(
    uploads: { id: string; file: File; attachedToBlockId: string }[],
  ) {
    const createdAt = new Date().getTime();

    await this.uploadsDb.uploads.bulkPut(
      uploads.map((u) => ({ id: u.id, file: u.file })),
    );

    await this.fileUploadsRepo.bulkCreate(
      uploads.map((u) => ({
        id: u.id,
        attachedToBlockId: u.attachedToBlockId,
        fileName: u.file.name,
        fileType: u.file.type,
        isUploaded: false,
        createdAt,
        url: undefined,
        isDownloaded: true,
      })),
      {
        shouldRecordChange: true,
        source: 'inDbChanges',
      },
    );
  }

  async getUpload(id: string) {
    return await this.uploadsDb.uploads.get(id);
  }
}
