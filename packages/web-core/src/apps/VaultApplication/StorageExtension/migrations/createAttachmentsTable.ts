import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { attachmentsTable } from '../repositories/AttachmentsRepository';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    CREATE TABLE ${attachmentsTable} (
      id varchar(20) PRIMARY KEY,
      attachedToBlockId varchar(20) NOT NULL,
      fileName TEXT NOT NULL,
      fileType varchar(100) NOT NULL,
      url TEXT,
      isUploaded INTEGER NOT NULL,
      isDownloaded INTEGER NOT NULL DEFAULT 0,

      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_file_uploads_attached_to_block_id ON ${attachmentsTable}(attachedToBlockId);
    CREATE INDEX IF NOT EXISTS idx_file_uploads_is_uploaded ON ${attachmentsTable}(isUploaded);
  `);
};

export const createAttachmentsTable: IMigration = {
  up,
  id: 1649321817498, // just take current UTC time, with `new Date().getTime()`
  name: 'createAttachmentsTable',
};
