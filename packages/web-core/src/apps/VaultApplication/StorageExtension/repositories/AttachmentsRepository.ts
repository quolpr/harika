import { omit } from 'lodash-es';
import sql, { raw } from 'sql-template-tag';

import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { BaseSyncRepository } from '../../../../extensions/SyncExtension/BaseSyncRepository';

export type IAttachmentDoc = {
  id: string;
  fileName: string;
  fileType: string;
  isUploaded: boolean;
  isDownloaded: boolean;
  shouldBeDeleted: boolean;
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
  async getNotUploadedAttachments(e: IQueryExecuter = this.db) {
    return await e.getRecords<IAttachmentDoc>(
      sql`SELECT * FROM ${raw(attachmentsTable)} WHERE isUploaded=0 LIMIT 10`,
    );
  }

  async getNotDownloadedAttachments(e: IQueryExecuter = this.db) {
    return await e.getRecords<IAttachmentDoc>(
      sql`SELECT * FROM ${raw(attachmentsTable)} WHERE isDownloaded=0 LIMIT 10`,
    );
  }

  toRow(doc: IAttachmentDoc): IAttachmentRow {
    const res = {
      ...super.toRow(doc),
      url: doc.url ? doc.url : null,
    };

    return omit(res, 'attachedToBlockId');
  }

  toDoc(row: IAttachmentRow): IAttachmentDoc {
    const res = {
      ...super.toDoc(row),
      url: row.url ? row.url : undefined,
    };

    return omit(res, 'attachedToBlockId');
  }

  getTableName() {
    return attachmentsTable;
  }

  getIgnoreSyncFields() {
    return ['isDownloaded' as const];
  }
}
