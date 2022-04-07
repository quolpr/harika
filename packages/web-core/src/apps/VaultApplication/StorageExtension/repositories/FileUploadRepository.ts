import { BaseSyncRepository } from '../../../../extensions/SyncExtension/BaseSyncRepository';

export type IFileUploadDoc = {
  id: string;
  attachedToBlockId: string;
  fileName: string;
  fileType: string;
  isUploaded: boolean;
  url: string | undefined;

  createdAt: number;
};
export type IFileUploadRow = IFileUploadDoc;

export type IFileUpload = IFileUploadDoc;

export const fileUploadsTable = 'fileUploads' as const;

export class FileUploadsRepository extends BaseSyncRepository<
  IFileUploadDoc,
  IFileUploadRow
> {
  getTableName() {
    return fileUploadsTable;
  }
}
