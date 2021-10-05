import type { SqlNotesRepository } from '../repositories/NotesRepository';
import type { SqlNotesBlocksRepository } from '../../NoteBlocksApp/repositories/NotesBlocksRepository';
import type { ISyncCtx } from '../../../../extensions/SyncExtension/persistence/syncCtx';

export class DeleteNoteService {
  constructor(
    private notesRepo: SqlNotesRepository,
    private notesBlocksRepo: SqlNotesBlocksRepository,
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
