import type { NoteBlockModel } from '../domain/NoteBlocksApp/models/NoteBlockModel';
import type { NoteModel } from '../domain/NotesApp/models/NoteModel';
import type { NoteBlockDoc } from '../persistence/NotesBlocksRepository';
import type { NoteDocType } from '../persistence/NotesRepository';

export const mapNoteBlock = (model: NoteBlockModel): NoteBlockDoc => {
  return {
    id: model.$modelId,
    noteId: model.noteId,
    content: model.content.value,
    createdAt: model.createdAt,
    noteBlockIds: model.noteBlockRefs.map(({ id }) => id),
    linkedNoteIds: [...model.linkedNoteIds],
    updatedAt: model.updatedAt,
  };
};
export const mapNote = (model: NoteModel): NoteDocType => {
  return {
    id: model.$modelId,
    dailyNoteDate: model.dailyNoteDate ? model.dailyNoteDate : null,
    title: model.title,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    rootBlockId: model.rootBlockId,
  };
};
// export const mapView = (model: any): BlocksViewDocType => {
//   return {
//     id: model.$modelId,
//     collapsedBlockIds: [...model.collapsedBlockIds],
//     noteId: model.blockTreeHolderRef.id,
//     scopedModelId: model.scopedModelId,
//     scopedModelType: model.scopedModelType,
//   };
// };
