import { IQueryExecuter } from '../../../../extensions/DbExtension/DB';
import { IMigration } from '../../../../extensions/DbExtension/types';
import { attachmentsTable } from '../repositories/AttachmentsRepository';

const up = async (db: IQueryExecuter) => {
  await db.sqlExec(`
    ALTER TABLE ${attachmentsTable}
    ADD COLUMN shouldBeDeleted INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_attachments_should_be_deleted ON ${attachmentsTable}(shouldBeDeleted);
  `);
};

export const addShouldBeDeletedToAttachments: IMigration = {
  up,
  id: 1649321817499, // just take current UTC time, with `new Date().getTime()`
  name: 'addShouldBeDeletedToAttachments',
};
