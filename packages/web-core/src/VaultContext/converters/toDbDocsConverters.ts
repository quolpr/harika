import type { NoteBlockModel } from '../domain/NoteBlocksApp/models/NoteBlockModel';
import type { BlocksScope } from '../domain/NoteBlocksApp/views/BlocksScope';
import type { NoteModel } from '../domain/NotesApp/models/NoteModel';
import type { BlocksScopeDoc } from '../persistence/BlockScopesRepository';
import type { NoteBlockDoc } from '../persistence/NotesBlocksRepository';
import type { NoteDoc } from '../persistence/NotesRepository';

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

export const mapBlocksScope = (model: BlocksScope): BlocksScopeDoc => {
  return {
    id: model.$modelId,
    collapsedBlockIds: Array.from(model.collapsedBlockIds),
    noteId: model.noteId,
    scopedModelId: model.scopedModelId,
    scopedModelType: model.scopedModelType,
    rootBlockId: model.rootScopedBlockId,
  };
};
