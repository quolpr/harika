import sql, { join, raw } from 'sql-template-tag';

import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { BaseSyncRepository } from '../../../../extensions/SyncExtension/BaseSyncRepository';

export type IAttachmentRelationDoc = {
  id: string;
  blockId: string;
  attachmentId: string;
  createdAt: number;
};
export type IAttachmentRelationRow = IAttachmentRelationDoc;

export const attachmentsRelationsTable = 'attachmentsRelationsTable' as const;

export class AttachmentsBlocksRelationsRepository extends BaseSyncRepository<
  IAttachmentRelationDoc,
  IAttachmentRelationRow
> {
  getAttachedTo(blockIds: string[], e: IQueryExecuter = this.db) {
    return e.getRecords<IAttachmentRelationDoc>(
      sql`SELECT * FROM ${raw(
        attachmentsRelationsTable,
      )} t WHERE t.blockId IN (${join(blockIds)})  LIMIT 10`,
    );
  }
  getTableName() {
    return attachmentsRelationsTable;
  }
}
