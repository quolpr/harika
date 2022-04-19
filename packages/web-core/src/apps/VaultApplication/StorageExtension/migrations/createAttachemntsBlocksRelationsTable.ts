import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { attachmentsRelationsTable } from '../repositories/AttachmentsBlocksRelationsRepository';
import { attachmentsTable } from '../repositories/AttachmentsRepository';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
     DROP INDEX idx_file_uploads_attached_to_block_id;
  `);
  await db.sqlExec(
    `ALTER TABLE ${attachmentsTable} DROP COLUMN attachedToBlockId;`,
  );

  await db.sqlExec(`
    CREATE TABLE ${attachmentsRelationsTable} (
      id varchar(20) PRIMARY KEY,
      attachmentId varchar(20) NOT NULL,
      blockId varchar(20) NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_block_id ON ${attachmentsRelationsTable}(blockId);
    CREATE INDEX IF NOT EXISTS idx_attachments_attachments_id ON ${attachmentsRelationsTable}(attachmentId);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_attachments_attachments_id_block_id ON ${attachmentsRelationsTable}(attachmentId, blockId);
  `);
};

export const createAttachmentsRelationsTable: IMigration = {
  up,
  id: 1650106264475, // just take current UTC time, with `new Date().getTime()`
  name: 'createAttachmentsRelationsTable',
};
