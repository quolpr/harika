import { NoteBlockModel, noteBlockRef } from '../models/NoteBlockMemModel';
import { NoteModel, noteRef } from '../models/NoteMemModel';
import { NoteBlockRow } from './models/NoteBlockDbModel';
import { NoteRow } from './models/NoteDbModel';

export const convertNoteBlockRowToModel = async (
  dbModel: NoteBlockRow,
  noteId: string
) => {
  const children = await dbModel.childBlocks.fetch();

  return new NoteBlockModel({
    $modelId: dbModel.id,
    content: dbModel.content,
    updatedAt: dbModel.updatedAt,
    createdAt: dbModel.createdAt,
    parentBlockRef: dbModel.parentBlockId
      ? noteBlockRef(dbModel.parentBlockId)
      : undefined,
    isPersisted: true,
    childBlockRefs: children.map((m) => noteBlockRef(m.id)),
    noteRef: noteRef(noteId),
  });
};

export const convertNoteRowToModel = async (dbModel: NoteRow) => {
  const noteBlockModels = await Promise.all(
    (await dbModel.noteBlocks.fetch()).map((m) =>
      convertNoteBlockRowToModel(m, dbModel.id)
    )
  );

  const noteModel = new NoteModel({
    $modelId: dbModel.id,
    title: dbModel.title,
    dailyNoteDate: dbModel.dailyNoteDate || new Date(),
    updatedAt: dbModel.updatedAt,
    createdAt: dbModel.createdAt,
    isPersisted: true,
    childBlockRefs: noteBlockModels
      .filter((m) => m.parentBlockRef === undefined)
      .map((m) => noteBlockRef(m)),
  });

  return { note: noteModel, noteBlocks: noteBlockModels };
};
