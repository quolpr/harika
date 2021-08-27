import type { NoteBlockModel } from '../domain/NoteBlockModel';
import type {
  BlocksViewDocType,
  NoteBlockDocType,
  NoteDocType,
} from '../../dexieTypes';
import type { NoteModel } from '../domain/NoteModel';
import type { BlocksViewModel } from '../domain/VaultUiState/BlocksViewModel';

export const mapNoteBlock = (model: NoteBlockModel): NoteBlockDocType => {
  return {
    id: model.$modelId,
    noteId: model.noteId,
    content: model.content.value,
    createdAt: model.createdAt,
    noteBlockIds: model.noteBlockRefs.map(({ id }) => id),
    linkedNoteIds: [...model.linkedNoteIds],
    isRoot: model.isRoot,
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
  };
};
export const mapView = (model: BlocksViewModel): BlocksViewDocType => {
  return {
    id: model.$modelId,
    collapsedBlockIds: [...model.collapsedBlockIds],
    noteId: model.blockTreeHolderRef.id,
    scopedModelId: model.scopedModelId,
    scopedModelType: model.scopedModelType,
  };
};
