import type { ModelCreationData } from 'mobx-keystone';
import { NoteBlockModel, noteBlockRef } from '../domain/NoteBlockModel';
import { INoteLoadStatus, NoteModel, noteRef } from '../domain/NoteModel';
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
    noteRef: noteRef(doc.noteId),
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
    noteRef: noteRef(doc.noteId),
    noteBlockRefs: doc.noteBlockIds
      .filter((v) => Boolean(v))
      .map((id) => noteBlockRef(id)),
    linkedNoteRefs: doc.linkedNoteIds
      .filter((v) => Boolean(v))
      .map((id) => noteRef(id)),
  };
};

export const convertNoteDocToModelAttrs = (
  doc: NoteDocType,
  loadStatus: INoteLoadStatus,
): NoteData => {
  return {
    $modelId: doc.id,
    title: doc.title,
    dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : new Date().getTime(),
    createdAt: doc.createdAt,
    areChildrenLoaded: loadStatus.areChildrenLoaded,
    areBlockLinksLoaded: loadStatus.areBlockLinksLoaded,
    areNoteLinksLoaded: loadStatus.areNoteLinksLoaded,
    rootBlockRef: noteBlockRef(doc.rootBlockId),
  };
};
