import type {NoteModel} from '../models/NoteModel';
import type {NoteDoc} from '../../NotesTree/repositories/NotesRepository';

export const mapNote = (model: NoteModel): NoteDoc => {
  return {
    id: model.$modelId,
    dailyNoteDate: model.dailyNoteDate ? model.dailyNoteDate : null,
    title: model.title,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    rootBlockId: model.rootBlockId,
  };
};

