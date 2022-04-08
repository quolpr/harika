import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { BaseSyncRepository } from '../../../../extensions/SyncExtension/BaseSyncRepository';
import { raw, sqltag } from '../../../../lib/sql';

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
  async getNotUploadedUploads(e: IQueryExecuter = this.db) {
    return await e.getRecords<IFileUploadDoc>(
      sqltag`SELECT * FROM ${raw(fileUploadsTable)} WHERE isUploaded=0`,
    );
  }

  getTableName() {
    return fileUploadsTable;
  }
}
