import type { ModelCreationData } from 'mobx-keystone';
import {
  NoteBlockModel,
  noteBlockRef,
} from '../domain/NoteBlocksApp/models/NoteBlockModel';
import type { NoteModel } from '../domain/NotesApp/models/NoteModel';
import type {
  NoteDocType,
  NoteBlockDocType,
  BlocksViewDocType,
} from '../../dexieTypes';
import { BlockContentModel } from '../domain/NoteBlocksApp/models/BlockContentModel';

export type NoteData = ModelCreationData<NoteModel> & {
  $modelId: string;
};
export type NoteBlockData = ModelCreationData<NoteBlockModel> & {
  $modelId: string;
};
export type ViewData = any & {
  $modelId: string;
};

export const convertViewToModelAttrs = (doc: BlocksViewDocType): ViewData => {
  return {
    $modelId: doc.id,
    collapsedBlockIds: doc.collapsedBlockIds,
    scopedModelId: doc.scopedModelId,
    scopedModelType: doc.scopedModelType,
  };
};

export const convertNoteBlockDocToModelAttrs = (
  doc: NoteBlockDocType,
): NoteBlockData => {
  return {
    $modelId: doc.id,
    content: new BlockContentModel({ value: doc.content }),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    noteId: doc.noteId,
    noteBlockRefs: doc.noteBlockIds
      .filter((v) => Boolean(v))
      .map((id) => noteBlockRef(id)),
    linkedNoteIds: doc.linkedNoteIds.filter((v) => Boolean(v)),
  };
};

export const convertNoteDocToModelAttrs = (doc: NoteDocType): NoteData => {
  return {
    $modelId: doc.id,
    title: doc.title,
    dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : undefined,
    rootBlockId: doc.rootBlockId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};
