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
      const linkedBlocks =
        await this.allRepo.getLinkedBlocksOfBlocksOfRootBlock(noteId, t);

      if (linkedBlocks.length > 0) {
        linkedBlocks.forEach((block) => {
          block.linkedBlockIds = block.linkedBlockIds.filter(
            (id) => id !== noteId,
          );
        });

        await this.allRepo.bulkUpdate(linkedBlocks, ctx, t);
      }

      await this.allRepo.bulkDelete(
        await this.allRepo.getDescendantIds(noteId, t),
        ctx,
        t,
      );
    });
  }
}
