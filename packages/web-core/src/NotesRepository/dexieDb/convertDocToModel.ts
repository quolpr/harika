import { uniq } from 'lodash-es';
import type { ModelCreationData } from 'mobx-keystone';
import { NoteBlockModel, noteBlockRef } from '../models/NoteBlockModel';
import { areNeededNoteDataLoaded, NoteModel } from '../models/NoteModel';
import { noteRef } from '../models/NoteModel';
import type { VaultDexieDatabase } from './DexieDb';
import type { NoteDocType, NoteBlockDocType } from '@harika/common';
import { BlockContentModel } from '../models/NoteBlockModel/BlockContentModel';

export type NoteData = ModelCreationData<NoteModel> & {
  $modelId: string;
};
export type NoteBlockData = ModelCreationData<NoteBlockModel> & {
  $modelId: string;
};

export const convertNoteBlockDocToModelAttrs = (
  doc: NoteBlockDocType,
): NoteBlockData => {
  return {
    $modelId: doc.id,
    content: new BlockContentModel({ value: doc.content }),
    createdAt: doc.createdAt,
    noteRef: noteRef(doc.noteId),
    // null == undefined for dexieDB modifications
    noteBlockRefs: doc.noteBlockIds.map((id) => noteBlockRef(id)),
    linkedNoteRefs: doc.linkedNoteIds.map((id) => noteRef(id)),
  };
};

export const convertNoteDocToModelAttrs = (
  doc: NoteDocType,
  areChildrenLoaded: boolean,
  areLinksLoaded: boolean,
  areBacklinksLoaded: boolean,
): NoteData => {
  return {
    $modelId: doc.id,
    title: doc.title,
    dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : new Date().getTime(),
    createdAt: doc.createdAt,
    areChildrenLoaded: areChildrenLoaded,
    areLinksLoaded: areLinksLoaded,
    areBacklinksLoaded: areBacklinksLoaded,
    rootBlockRef: noteBlockRef(doc.rootBlockId),
  };
};

// TODO: could be optimized
const loadNoteDocToModelAttrsWithoutTx = async (
  db: VaultDexieDatabase,
  noteDoc: NoteDocType,
  preloadChildren: boolean,
  preloadBlockLinks: boolean,
  preloadNoteBacklinks: boolean,
  notes: NoteData[] = [],
  noteBlocks: NoteBlockData[] = [],
) => {
  const noteBlocksQueries = db.noteBlocksQueries;
  const notesQueries = db.notesQueries;

  const alreadyLoadedNote = notes.find(
    ({ $modelId }) => $modelId === noteDoc.id,
  );

  if (alreadyLoadedNote) {
    if (
      areNeededNoteDataLoaded(
        alreadyLoadedNote,
        preloadChildren,
        preloadBlockLinks,
        preloadNoteBacklinks,
      )
    ) {
      return { notes, noteBlocks };
    }
  }

  notes.push(
    convertNoteDocToModelAttrs(
      noteDoc,
      preloadChildren,
      preloadBlockLinks,
      preloadNoteBacklinks,
    ),
  );

  const noteBlockAttrs = preloadChildren
    ? await Promise.all(
        (
          await noteBlocksQueries.getByNoteId(noteDoc.id)
        ).map((m) => convertNoteBlockDocToModelAttrs(m)),
      )
    : [];

  noteBlocks.push(...noteBlockAttrs);

  if (preloadNoteBacklinks) {
    await Promise.all(
      (
        await notesQueries.getLinkedNotesOfNoteId(noteDoc.id)
      ).map((doc) =>
        loadNoteDocToModelAttrsWithoutTx(
          db,
          doc,
          true,
          true,
          false,
          notes,
          noteBlocks,
        ),
      ),
    );
  }

  if (preloadBlockLinks) {
    const noteIds = uniq(
      noteBlockAttrs.flatMap(({ linkedNoteRefs }) =>
        (linkedNoteRefs || []).map(({ id }) => id),
      ),
    );

    await Promise.all(
      (
        await notesQueries.getByIds(noteIds)
      ).map((doc) =>
        loadNoteDocToModelAttrsWithoutTx(
          db,
          doc,
          false,
          false,
          false,
          notes,
          noteBlocks,
        ),
      ),
    );
  }

  return {
    notes,
    noteBlocks,
  };
};

export const loadNoteDocToModelAttrs = async (
  db: VaultDexieDatabase,
  noteDoc: NoteDocType,
  preloadChildren: boolean,
  preloadBlockLinks: boolean,
  preloadNoteBacklinks: boolean,
) => {
  return db.transaction(
    'r',

    db.notes,
    db.noteBlocks,

    async () => {
      return loadNoteDocToModelAttrsWithoutTx(
        db,
        noteDoc,
        preloadChildren,
        preloadBlockLinks,
        preloadNoteBacklinks,
      );
    },
  );
};
