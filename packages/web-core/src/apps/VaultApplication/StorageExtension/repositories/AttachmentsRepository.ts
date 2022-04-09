import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { BaseSyncRepository } from '../../../../extensions/SyncExtension/BaseSyncRepository';
import { raw, sqltag } from '../../../../lib/sql';

export type IAttachmentDoc = {
  id: string;
  attachedToBlockId: string;
  fileName: string;
  fileType: string;
  isUploaded: boolean;
  isDownloaded: boolean;
  url: string | undefined;

  createdAt: number;
};
export type IAttachmentRow = IAttachmentDoc;

export const attachmentsTable = 'attachmentsTable' as const;

export class AttachmentsRepository extends BaseSyncRepository<
  IAttachmentDoc,
  IAttachmentRow
> {
  async getNotUploadedUploads(e: IQueryExecuter = this.db) {
    return await e.getRecords<IAttachmentDoc>(
      sqltag`SELECT * FROM ${raw(
        attachmentsTable,
      )} WHERE isUploaded=0 LIMIT 10`,
    );
  }

  async getNotDownloadedUploads(e: IQueryExecuter = this.db) {
    return await e.getRecords<IAttachmentDoc>(
      sqltag`SELECT * FROM ${raw(
        attachmentsTable,
      )} WHERE isDownloaded=0 LIMIT 10`,
    );
  }

  getTableName() {
    return attachmentsTable;
  }

  getIgnoreSyncFields() {
    return ['isDownloaded' as const];
  }
}
