import { uniq } from 'lodash-es';
import type { ModelCreationData } from 'mobx-keystone';
import { NoteBlockModel, noteBlockRef } from '../models/NoteBlockModel';
import type { NoteModel } from '../models/NoteModel';
import { BlockContentModel } from '../models/BlockContentModel';
import { noteRef } from '../models/NoteModel';
import type { VaultDexieDatabase } from './DexieDb';
import type { NoteDocType, NoteBlockDocType } from '@harika/common';

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
  preloadChildren = true,
  preloadBlockLinks = true,
  preloadNoteBacklinks = true,
  notes: NoteData[] = [],
  noteBlocks: NoteBlockData[] = [],
) => {
  const noteBlocksQueries = db.noteBlocksQueries;
  const notesQueries = db.notesQueries;

  const noteBlockAttrs = preloadChildren
    ? await Promise.all(
        (
          await noteBlocksQueries.getByNoteId(noteDoc.id)
        ).map((m) => convertNoteBlockDocToModelAttrs(m)),
      )
    : [];

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

  noteBlocks.push(...noteBlockAttrs);
  notes.push(
    convertNoteDocToModelAttrs(
      noteDoc,
      preloadChildren,
      preloadBlockLinks,
      preloadNoteBacklinks,
    ),
  );

  return {
    notes,
    noteBlocks,
  };
};

export const loadNoteDocToModelAttrs = async (
  db: VaultDexieDatabase,
  noteDoc: NoteDocType,
  preloadChildren = true,
  preloadBlockLinks = true,
  preloadNoteBacklinks = true,
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
