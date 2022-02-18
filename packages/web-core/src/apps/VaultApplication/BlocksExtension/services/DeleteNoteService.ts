import { inject, injectable } from 'inversify';

import { DB } from '../../../../extensions/DbExtension/DB';
import { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { AllBlocksRepository } from '../../BlocksExtension/repositories/AllBlocksRepository';
import { BlockLinksRepository } from '../repositories/BlockLinkRepository';

@injectable()
export class DeleteNoteService {
  constructor(
    @inject(DB) private db: DB,
    @inject(AllBlocksRepository) private allRepo: AllBlocksRepository,
    @inject(BlockLinksRepository) private blockLinksRepo: BlockLinksRepository,
  ) {}

  async deleteBlock(noteId: string) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };
    await this.db.transaction(async (t) => {
      const backlinkedBlockIds = (
        await this.blockLinksRepo.getBacklinksOfDescendants(noteId, false, t)
      ).links.map(({ id }) => id);

      if (backlinkedBlockIds.length > 0) {
        await this.blockLinksRepo.bulkDelete(backlinkedBlockIds, ctx, t);
      }

      await this.allRepo.bulkRecursiveDelete([noteId], ctx, t);
    });
  }
}
