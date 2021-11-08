import { NotesBlocksRepository } from '../../NoteBlocksExtension/repositories/NotesBlocksRepository';
import type { ISyncCtx } from '../../../../extensions/SyncExtension/syncCtx';
import { NotesRepository } from '../../NotesExtension/repositories/NotesRepository';
import { inject, injectable } from 'inversify';

@injectable()
export class DeleteNoteService {
  constructor(
    @inject(NotesRepository) private notesRepo: NotesRepository,
    @inject(NotesBlocksRepository)
    private notesBlocksRepo: NotesBlocksRepository,
  ) {}

  async deleteNote(noteId: string) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };
    await this.notesRepo.transaction(async (t) => {
      const linkedBlocks = await this.notesBlocksRepo.getLinkedBlocksOfNoteId(
        noteId,
        t,
      );

      if (linkedBlocks.length > 0) {
        linkedBlocks.forEach((block) => {
          block.linkedNoteIds = block.linkedNoteIds.filter(
            (id) => id !== noteId,
          );
        });
        this.notesBlocksRepo.bulkUpdate(linkedBlocks, ctx, t);
      }

      this.notesRepo.delete(noteId, ctx, t);
      this.notesBlocksRepo.bulkDelete(
        await this.notesBlocksRepo.getIdsByNoteId(noteId, t),
        ctx,
        t,
      );
    });
  }
}
