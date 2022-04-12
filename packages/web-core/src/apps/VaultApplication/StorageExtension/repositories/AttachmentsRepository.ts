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
export type IAttachmentRow = Omit<IAttachmentDoc, 'url'> & {
  url: string | null;
};

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

  toRow(doc: IAttachmentDoc): IAttachmentRow {
    const res = {
      ...super.toRow(doc),
      url: doc.url ? doc.url : null,
    };

    return res;
  }

  toDoc(row: IAttachmentRow): IAttachmentDoc {
    const res = {
      ...super.toDoc(row),
      url: row.url ? row.url : undefined,
    };

    return res;
  }

  getTableName() {
    return attachmentsTable;
  }

  getIgnoreSyncFields() {
    return ['isDownloaded' as const];
  }
}
