import type {NoteBlockModel} from "../domain/NoteBlockModel";
import type {BlocksViewDocType, NoteBlockDocType, NoteDocType} from "../../dexieTypes";
import type {NoteModel} from "../domain/NoteModel";
import type {BlocksViewModel} from "../domain/VaultUiState/BlocksViewModel";

export const mapNoteBlock = (model: NoteBlockModel): NoteBlockDocType => {
  return {
    id: model.$modelId,
    noteId: model.noteRef.id,
    content: model.content.value,
    createdAt: model.createdAt,
    noteBlockIds: model.noteBlockRefs.map(({id}) => id),
    linkedNoteIds: model.linkedNoteRefs.map(({id}) => id),
  };
};
export const mapNote = (model: NoteModel): NoteDocType => {
  return {
    id: model.$modelId,
    dailyNoteDate: model.dailyNoteDate,
    title: model.title,
    createdAt: model.createdAt,
    rootBlockId: model.rootBlockRef.id,
  };
};
export const mapView = (model: BlocksViewModel): BlocksViewDocType => {
  return {
    id: model.$modelId,
    collapsedBlockIds: [...model.collapsedBlockIds],
    noteId: model.noteRef.id,
    scopedModelId: model.scopedModelId,
    scopedModelType: model.scopedModelType,
  };
};
