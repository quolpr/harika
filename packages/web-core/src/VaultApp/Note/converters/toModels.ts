import type {ModelCreationData} from 'mobx-keystone';
import type {NoteModel} from '../models/NoteModel';
import type {NoteDoc} from '../../NotesTree/repositories/NotesRepository';

export type NoteData = ModelCreationData<NoteModel> & {
  $modelId: string;
};

export const convertNoteDocToModelAttrs = (doc: NoteDoc): NoteData => {
  return {
    $modelId: doc.id,
    title: doc.title,
    dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : undefined,
    rootBlockId: doc.rootBlockId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};
