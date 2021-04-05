import { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
import { NoteModel, noteRef } from './models/NoteModel';
import { ModelInstanceCreationData } from 'mobx-keystone';
import { NoteDocument } from './rxdb/NoteDoc';
import { NoteBlockDocument } from './rxdb/NoteBlockDoc';
import { VaultRxDatabase } from './rxdb/initDb';
import { uniq } from 'lodash-es';

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

export const convertNoteBlockRowToModelAttrs = (
  dbModel: NoteBlockDocument
): NoteBlockData => {
  return {
    $modelId: dbModel._id,
    content: dbModel.content,
    createdAt: new Date(dbModel.createdAt),
    parentBlockRef: dbModel.parentBlockId
      ? noteBlockRef(dbModel.parentBlockId)
      : undefined,
    noteRef: noteRef(dbModel.noteId),
    noteBlockRefs: dbModel.noteBlockIds.map((b) => noteBlockRef(b)),
    linkedNoteRefs: dbModel.linkedNoteIds.map((n) => noteRef(n)),
  };
};

export const simpleConvertNoteDbToModelAttrsSync = (
  dbModel: NoteDocument,
  areChildrenLoaded: boolean,
  areLinksLoaded: boolean
): NoteData => {
  return {
    $modelId: dbModel._id,
    title: dbModel.title,
    dailyNoteDate: dbModel.dailyNoteDate
      ? new Date(dbModel.dailyNoteDate)
      : new Date(),
    createdAt: new Date(dbModel.createdAt),
    areChildrenLoaded: areChildrenLoaded,
    areLinksLoaded: areLinksLoaded,
    rootBlockRef: noteBlockRef(dbModel.rootBlockId),
  };
};

export const convertNoteRowToModelAttrs = async (
  db: VaultRxDatabase,
  noteDoc: NoteDocument,
  preloadChildren = true,
  preloadLinks = true
): Promise<IConvertResult> => {
  const noteBlockAttrs = preloadChildren
    ? await Promise.all(
        (await noteDoc.getNoteBlocks()).map((m) =>
          convertNoteBlockRowToModelAttrs(m)
        )
      )
    : [];

  const linkedNotes: IConvertResult[] = [];

  if (preloadChildren) {
    linkedNotes.push(
      ...(await Promise.all(
        (await noteDoc.getLinkedNotes()).map((doc) =>
          convertNoteRowToModelAttrs(db, doc, true, false)
        )
      ))
    );

    const noteIds = uniq(
      noteBlockAttrs.flatMap(({ linkedNoteRefs }) =>
        linkedNoteRefs.map(({ id }) => id)
      )
    );

    linkedNotes.push(
      ...(await Promise.all(
        (await db.notes.getByIds(noteIds)).map((doc) =>
          convertNoteRowToModelAttrs(db, doc, false, false)
        )
      ))
    );
  }

  const noteModel = simpleConvertNoteDbToModelAttrsSync(
    noteDoc,
    preloadChildren,
    preloadLinks
  );

  return {
    note: noteModel,
    noteBlocks: noteBlockAttrs,
    linkedNotes: linkedNotes,
  };
};
