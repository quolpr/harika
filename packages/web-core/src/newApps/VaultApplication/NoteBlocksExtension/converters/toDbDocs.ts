import {BlocksScope} from "../../../../apps/VaultApp/NoteBlocksApp/views/BlocksScope";
import {BlocksScopeDoc} from "../repositories/BlockScopesRepository";
import {NoteBlockModel} from "../models/NoteBlockModel";
import {NoteBlockDoc} from "../repositories/NotesBlocksRepository";

export const mapNoteBlock = (model: NoteBlockModel): NoteBlockDoc => {
    return {
        id: model.$modelId,
        noteId: model.noteId,
        content: model.content._value,
        createdAt: model.createdAt,
        noteBlockIds: model.noteBlockRefs.map(({id}) => id),
        linkedNoteIds: [...model.linkedNoteIds],
        linkedBlockIds: [...model.linkedBlockIds],
        updatedAt: model.updatedAt,
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
