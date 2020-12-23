import { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
import { NoteModel, noteRef } from './models/NoteModel';
import { NoteBlockRow } from './db/rows/NoteBlockRow';
import { NoteRow } from './db/rows/NoteRow';

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
  });
};

export const convertNoteRowToModel = async (
  dbModel: NoteRow,
  loadChildren = true
) => {
  const noteBlockModels = loadChildren
    ? await Promise.all(
        (await dbModel.noteBlocks.fetch()).map((m) =>
          convertNoteBlockRowToModel(m, dbModel.id)
        )
      )
    : [];

  const noteModel = new NoteModel({
    $modelId: dbModel.id,
    title: dbModel.title,
    dailyNoteDate: dbModel.dailyNoteDate || new Date(),
    updatedAt: dbModel.updatedAt,
    createdAt: dbModel.createdAt,
    isPersisted: true,
    childBlockRefs: loadChildren
      ? (dbModel.childBlockIds || []).map((id) => noteBlockRef(id))
      : [],
    areChildrenLoaded: loadChildren,
  });

  return { note: noteModel, noteBlocks: noteBlockModels };
};
