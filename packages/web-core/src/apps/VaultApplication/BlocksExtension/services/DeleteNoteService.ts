import { inject, injectable } from 'inversify';
import { DB } from '../../../../extensions/DbExtension/DB';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { AllBlocksRepository } from '../../BlocksExtension/repositories/AllBlocksRepository';

@injectable()
export class DeleteNoteService {
  constructor(
    @inject(DB) private db: DB,
    @inject(AllBlocksRepository) private allRepo: AllBlocksRepository,
  ) {}

  async deleteBlock(noteId: string) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };
    await this.db.transaction(async (t) => {
      const backlinkedBlockIds = (
        await this.allRepo.getBacklinkedBlockIds(noteId, false, t)
      ).linkedBlockIds.map(({ blockId }) => blockId);

      if (backlinkedBlockIds.length > 0) {
        const linkedBlocks = await this.allRepo.getSingleBlocksByIds(
          backlinkedBlockIds,
          t,
        );

        linkedBlocks.forEach((block) => {
          block.linkedBlockIds = block.linkedBlockIds.filter(
            (id) => id !== noteId,
          );
        });

        await this.allRepo.bulkUpdate(linkedBlocks, ctx, t);
      }

      await this.allRepo.bulkRecursiveDelete([noteId], ctx, t);
    });
  }
}
