import type { ModelCreationData } from 'mobx-keystone';
import {
  blocksTreeHolderRef,
  NoteBlockModel,
  noteBlockRef,
} from '../domain/NoteBlockModel';
import type { NoteModel } from '../domain/NoteModel';
import type {
  NoteDocType,
  NoteBlockDocType,
  BlocksViewDocType,
} from '../../dexieTypes';
import { BlockContentModel } from '../domain/NoteBlockModel/BlockContentModel';
import type { BlocksViewModel } from '../domain/VaultUiState/BlocksViewModel';

export type NoteData = ModelCreationData<NoteModel> & {
  $modelId: string;
};
export type NoteBlockData = ModelCreationData<NoteBlockModel> & {
  $modelId: string;
};
export type ViewData = ModelCreationData<BlocksViewModel> & {
  $modelId: string;
};

export const convertViewToModelAttrs = (doc: BlocksViewDocType): ViewData => {
  return {
    $modelId: doc.id,
    collapsedBlockIds: doc.collapsedBlockIds,
    blockTreeHolderRef: blocksTreeHolderRef(doc.noteId),
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
    noteId: doc.noteId,
    noteBlockRefs: doc.noteBlockIds
      .filter((v) => Boolean(v))
      .map((id) => noteBlockRef(id)),
    linkedNoteIds: doc.linkedNoteIds.filter((v) => Boolean(v)),
    isRoot: Boolean(doc.isRoot),
  };
};

export const convertNoteDocToModelAttrs = (doc: NoteDocType): NoteData => {
  return {
    $modelId: doc.id,
    title: doc.title,
    dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : new Date().getTime(),
    createdAt: doc.createdAt,
  };
};
