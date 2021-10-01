import {ModelCreationData} from "mobx-keystone";
import {NoteBlockModel, noteBlockRef} from "../models/NoteBlockModel";
import {NoteBlockDoc} from "../repositories/NotesBlocksRepository";
import {BlockContentModel} from "../models/BlockContentModel";

export type NoteBlockData = ModelCreationData<NoteBlockModel> & {
    $modelId: string;
};
export type ViewData = any & {
    $modelId: string;
};
export const convertNoteBlockDocToModelAttrs = (
    doc: NoteBlockDoc,
): NoteBlockData => {
    return {
        $modelId: doc.id,
        content: new BlockContentModel({_value: doc.content}),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        noteId: doc.noteId,
        noteBlockRefs: doc.noteBlockIds
            .filter((v) => Boolean(v))
            .map((id) => noteBlockRef(id)),
        linkedNoteIds: doc.linkedNoteIds.filter((v) => Boolean(v)),
        linkedBlockIds: doc.linkedBlockIds.filter((v) => Boolean(v)),
    };
};
