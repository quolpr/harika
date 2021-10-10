import type { NotesBlocksRepository } from '../../NoteBlocksExtension/repositories/NotesBlocksRepository';
import type { ISyncCtx } from '../../../../extensions/SyncExtension/persistence/syncCtx';
import { NotesRepository } from '../../NotesExtension/repositories/NotesRepository';
import { inject, injectable } from 'inversify';

@injectable()
export class DeleteNoteService {
  constructor(
    @inject(NotesRepository) private notesRepo: NotesRepository,
    @inject(NotesRepository) private notesBlocksRepo: NotesBlocksRepository,
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
