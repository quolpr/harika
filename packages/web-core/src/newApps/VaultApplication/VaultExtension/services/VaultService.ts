import { inject, injectable } from 'inversify';
import { NoteBlocksService } from '../../NoteBlocksExtension/services/NoteBlocksService';
import { NotesService } from '../../NotesExtension/services/NotesService';
import type { Optional, Required } from 'utility-types';
import { ModelCreationData } from 'mobx-keystone';
import { NoteModel } from '../../NotesExtension/models/NoteModel';

@injectable()
export class VaultService {
  constructor(
    @inject(NotesService) private notesService: NotesService,
    @inject(NoteBlocksService) private noteBlocksService: NoteBlocksService,
  ) {}

  async createNote(
    attrs: Required<
      Optional<
        ModelCreationData<NoteModel>,
        'createdAt' | 'updatedAt' | 'dailyNoteDate'
      >,
      'title'
    >,
    options?: { isDaily?: boolean },
  ) {
    const result = await this.notesService.createNote(attrs, options);
    if (result.status === 'ok') {
      const { registry, rootBlock } = this.noteBlocksService.createBlocksTree(
        result.data.$modelId,
      );

      return {
        status: 'ok' as const,
        data: {
          note: result.data,
          registry,
          rootBlock,
        },
      };
    } else {
      return result;
    }
  }
}
