import { uniq } from 'lodash-es';
import { ModelInstanceCreationData } from 'mobx-keystone';
import { NoteBlockModel, noteBlockRef } from '../models/NoteBlockModel';
import { NoteModel } from '../models/NoteModel';

import { BlockContentModel } from '../models/BlockContentModel';
import { noteRef } from '../models/NoteModel';
import { NoteBlockDocType, NoteDocType, VaultDexieDatabase } from './DexieDb';

type NoteData = ModelInstanceCreationData<NoteModel> & {
  $modelId: string;
};
type NoteBlockData = ModelInstanceCreationData<NoteBlockModel> & {
  $modelId: string;
};

interface IConvertResult {
  note: NoteData;
  noteBlocks: NoteBlockData[];
  linkedNotes: IConvertResult[];
}

export const convertNoteBlockDocToModelAttrs = (
  doc: NoteBlockDocType
): NoteBlockData => {
  console.log({ doc });
  return {
    syncId: doc.syncId,
    $modelId: doc.shortId,
    content: new BlockContentModel({ value: doc.content }),
    createdAt: new Date(doc.createdAt),
    parentBlockRef: doc.parentBlockId
      ? noteBlockRef(doc.parentBlockId)
      : undefined,
    noteRef: noteRef(doc.noteId),
    // null == undefined for dexieDB modifications
    noteBlockRefs: doc.noteBlockIds.filter(Boolean).map((b) => noteBlockRef(b)),
    linkedNoteRefs: doc.linkedNoteIds.filter(Boolean).map((n) => noteRef(n)),
  };
};

export const convertNoteDocToModelAttrs = (
  doc: NoteDocType,
  areChildrenLoaded: boolean,
  areLinksLoaded: boolean
): NoteData => {
  return {
    syncId: doc.syncId,
    $modelId: doc.shortId,
    title: doc.title,
    dailyNoteDate: doc.dailyNoteDate ? new Date(doc.dailyNoteDate) : new Date(),
    createdAt: new Date(doc.createdAt),
    areChildrenLoaded: areChildrenLoaded,
    areLinksLoaded: areLinksLoaded,
    rootBlockRef: noteBlockRef(doc.rootBlockId),
  };
};

// TODO: could be optimized
export const loadNoteDocToModelAttrs = async (
  db: VaultDexieDatabase,
  noteDoc: NoteDocType,
  preloadChildren = true,
  preloadBlockLinks = true,
  preloadNoteBacklinks = true
) => {
  const noteBlocksQueries = db.noteBlocksQueries;
  const notesQueries = db.notesQueries;

  const noteBlockAttrs = preloadChildren
    ? await Promise.all(
        (await noteBlocksQueries.getByNoteId(noteDoc.shortId)).map((m) =>
          convertNoteBlockDocToModelAttrs(m)
        )
      )
    : [];

  const linkedNotes: IConvertResult[] = [];

  if (preloadNoteBacklinks) {
    linkedNotes.push(
      ...(await Promise.all(
        (
          await notesQueries.getLinkedNotesOfNoteId(noteDoc.shortId)
        ).map((doc) => loadNoteDocToModelAttrs(db, doc, true, true, false))
      ))
    );
  }

  if (preloadBlockLinks) {
    const noteIds = uniq(
      noteBlockAttrs.flatMap(({ linkedNoteRefs }) =>
        linkedNoteRefs.map(({ id }) => id)
      )
    );

    linkedNotes.push(
      ...(await Promise.all(
        (await notesQueries.getByIds(noteIds)).map((doc) =>
          loadNoteDocToModelAttrs(db, doc, false, false, false)
        )
      ))
    );
  }

  const noteModel = convertNoteDocToModelAttrs(
    noteDoc,
    preloadChildren,
    preloadBlockLinks
  );

  return {
    note: noteModel,
    noteBlocks: noteBlockAttrs,
    linkedNotes: linkedNotes,
  };
};
