import { IMapper } from '../../../../../extensions/SyncExtension/app/mappers';
import { NoteModel } from '../models/NoteModel';
import { NoteDoc, notesTable } from '../../worker/repositories/NotesRepository';

export const notesMapper: IMapper<NoteDoc, NoteModel> = {
  mapToModelData(doc) {
    return {
      $modelId: doc.id,
      title: doc.title,
      dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  },
  mapToDoc(model) {
    return {
      id: model.$modelId,
      dailyNoteDate: model.dailyNoteDate ? model.dailyNoteDate : null,
      title: model.title,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  },
  tableName: notesTable,
  model: NoteModel,
};
