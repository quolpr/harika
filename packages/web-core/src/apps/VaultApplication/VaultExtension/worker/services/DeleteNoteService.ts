import { NotesBlocksRepository } from '../../../NoteBlocksExtension/worker/repositories/NotesBlocksRepository';
import type { ISyncCtx } from '../../../../../extensions/SyncExtension/worker/syncCtx';
import { NotesRepository } from '../../../NotesExtension/worker/repositories/NotesRepository';
import { inject, injectable } from 'inversify';
import { remotable } from '../../../../../framework/utils';

@remotable('DeleteNoteService')
@injectable()
export class DeleteNoteService {
  constructor(
    @inject(NotesRepository) private notesRepo: NotesRepository,
    @inject(NotesBlocksRepository)
    private notesBlocksRepo: NotesBlocksRepository,
  ) {}

  deleteNote(noteId: string) {
    const ctx: ISyncCtx = {
      shouldRecordChange: true,
      source: 'inDbChanges',
    };
    this.notesRepo.transaction(() => {
      const linkedBlocks = this.notesBlocksRepo.getLinkedBlocksOfNoteId(noteId);

      if (linkedBlocks.length > 0) {
        linkedBlocks.forEach((block) => {
          block.linkedNoteIds = block.linkedNoteIds.filter(
            (id) => id !== noteId,
          );
        });
        this.notesBlocksRepo.bulkUpdate(linkedBlocks, ctx);
      }

      this.notesRepo.delete(noteId, ctx);
      this.notesBlocksRepo.bulkDelete(
        this.notesBlocksRepo.getIdsByNoteId(noteId),
        ctx,
      );
    });
  }
}
