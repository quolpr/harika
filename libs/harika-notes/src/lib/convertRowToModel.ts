import { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
import { NoteModel, noteRef } from './models/NoteModel';
import { NoteBlockRow } from './db/rows/NoteBlockRow';
import { NoteRow } from './db/rows/NoteRow';
import { Queries } from './db/Queries';

export const convertNoteBlockRowToModel = async (
  dbModel: NoteBlockRow,
  noteId: string
) => {
  return new NoteBlockModel({
    $modelId: dbModel.id,
    content: dbModel.content,
    updatedAt: dbModel.updatedAt,
    createdAt: dbModel.createdAt,
    parentBlockRef: dbModel.parentBlockId
      ? noteBlockRef(dbModel.parentBlockId)
      : undefined,
    isPersisted: true,
    childBlockRefs: (dbModel.childBlockIds || []).map((id) => noteBlockRef(id)),
    noteRef: noteRef(noteId),
    linkedNoteRefs: (dbModel.linkedNoteIds || []).map((id) => noteRef(id)),
  });
};

interface IConvertResult {
  note: NoteModel;
  noteBlocks: NoteBlockModel[];
  linkedNotes: IConvertResult[];
}

// TODO: extract from convertNoteRowToModel
export const loadLinkedNotesOfNote = async (
  queries: Queries,
  dbModel: NoteRow,
  preloadChildren = true,
  preloadLinks = false
) => {
  return preloadLinks
    ? await Promise.all(
        (
          await queries.getNoteRowsOfNoteBlockIds(
            dbModel.linkedNoteBlockIds || []
          )
        ).map((row) =>
          convertNoteRowToModel(queries, row, preloadChildren, preloadLinks)
        )
      )
    : [];
};

export const convertNoteRowToModel = async (
  queries: Queries,
  dbModel: NoteRow,
  preloadChildren = true,
  preloadLinks = true
): Promise<IConvertResult> => {
  const noteBlockModels = preloadChildren
    ? await Promise.all(
        (await dbModel.noteBlocks.fetch()).map((m) =>
          convertNoteBlockRowToModel(m, dbModel.id)
        )
      )
    : [];

  const linkedNotes = preloadLinks
    ? await Promise.all(
        (
          await queries.getNoteRowsOfNoteBlockIds(
            dbModel.linkedNoteBlockIds || []
          )
        ).map((row) => convertNoteRowToModel(queries, row, true, false))
      )
    : [];

  const linkedNoteBlockRefs = preloadLinks
    ? (dbModel.linkedNoteBlockIds || []).map((noteBlockId) =>
        noteBlockRef(noteBlockId)
      )
    : [];

  const noteModel = new NoteModel({
    $modelId: dbModel.id,
    title: dbModel.title,
    dailyNoteDate: dbModel.dailyNoteDate || new Date(),
    updatedAt: dbModel.updatedAt,
    createdAt: dbModel.createdAt,
    isPersisted: true,
    childBlockRefs: preloadChildren
      ? (dbModel.childBlockIds || []).map((id) => noteBlockRef(id))
      : [],
    areChildrenLoaded: preloadChildren,
    linkedNoteBlockRefs: linkedNoteBlockRefs,
    areLinksLoaded: preloadLinks,
  });

  return { note: noteModel, noteBlocks: noteBlockModels, linkedNotes };
};
