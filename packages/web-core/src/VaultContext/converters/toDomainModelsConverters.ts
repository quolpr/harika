import type { ModelCreationData } from 'mobx-keystone';
import {
  NoteBlockModel,
  noteBlockRef,
} from '../domain/NoteBlocksApp/models/NoteBlockModel';
import type { NoteModel } from '../domain/NotesApp/models/NoteModel';
import { BlockContentModel } from '../domain/NoteBlocksApp/models/BlockContentModel';
import type { NoteBlockDoc } from '../persistence/NotesBlocksRepository';
import type { NoteDoc } from '../persistence/NotesRepository';

export type NoteData = ModelCreationData<NoteModel> & {
  $modelId: string;
};
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
    content: new BlockContentModel({ _value: doc.content }),
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
