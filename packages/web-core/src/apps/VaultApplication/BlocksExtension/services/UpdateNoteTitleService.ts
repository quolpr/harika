import { inject, injectable } from 'inversify';

import { NoteBlocksService } from './NoteBlocksService';

@injectable()
export class UpdateNoteTitleService {
  constructor(
    @inject(NoteBlocksService) private notesService: NoteBlocksService,
  ) {}

  async updateNoteTitle(noteId: string, newTitle: string) {
    const exists = await this.notesService.isNoteExists(newTitle);

    if (exists) return 'exists' as const;

    const note = await this.notesService.getNote(noteId);

    if (!note) return;

    const oldTitle = note.title;

    return 'ok';
  }
}
