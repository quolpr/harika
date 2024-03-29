import { inject, injectable } from 'inversify';
import { maxBy, minBy } from 'lodash-es';
import sql, { raw } from 'sql-template-tag';

import { Transaction } from '../../../../extensions/DbExtension/DB';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { ISyncConflictResolver } from '../../../../extensions/SyncExtension/types';
import { AllBlocksRepository } from '../repositories/AllBlocksRepository';
import { noteBlocksTable } from '../repositories/NoteBlocksRepostitory';

@injectable()
export class DuplicatedNotesConflictResolver implements ISyncConflictResolver {
  constructor(
    @inject(AllBlocksRepository) private allBlocksRepo: AllBlocksRepository,
  ) {}

  async resolve(t: Transaction) {
    const res = await t.getRecords<{ title: string }>(
      sql`SELECT title FROM ${raw(
        noteBlocksTable,
      )} t GROUP BY t.title HAVING COUNT(t.title) > 1`,
    );

    const syncCtx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };

    for (const { title } of res) {
      const records = await t.getRecords<{ id: string; createdAt: string }>(
        sql`SELECT id, createdAt FROM ${raw(
          noteBlocksTable,
        )} WHERE title = ${title}`,
      );

      const oldestNote = minBy(records, (r) => r.createdAt);

      if (!oldestNote) continue;

      const oldestNoteChildren = await this.allBlocksRepo.getChildrenOfParents(
        [oldestNote?.id],
        t,
      );
      const maxOrder =
        maxBy(oldestNoteChildren, (ch) => ch.orderPosition)?.orderPosition || 0;

      const notesToDelete = await this.allBlocksRepo.getSingleBlocksByIds(
        records.filter(({ id }) => id !== oldestNote.id).map(({ id }) => id),
        t,
      );

      const childrenToMove = await this.allBlocksRepo.getChildrenOfParents(
        notesToDelete.map(({ id }) => id),
        t,
      );

      await this.allBlocksRepo.bulkUpdate(
        childrenToMove.map((ch, i) => {
          return {
            ...ch,
            parentId: oldestNote.id,
            orderPosition: maxOrder + i + 1,
          };
        }),
        syncCtx,
        t,
      );

      await this.allBlocksRepo.bulkDelete(
        notesToDelete.map(({ id }) => id),
        false,
        syncCtx,
        t,
      );
    }
  }

  get collectionNamesToResolve() {
    return [noteBlocksTable];
  }
}
