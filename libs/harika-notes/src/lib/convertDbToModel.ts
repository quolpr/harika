import {
  NoteBlockMemModel,
  noteBlockRef,
} from './MemoryDb/models/NoteBlockMemModel';
import { NoteMemModel, noteRef } from './MemoryDb/models/NoteMemModel';
import { NoteBlockDbModel } from './PersistentDb/models/NoteBlockDbModel';
import { NoteDbModel } from './PersistentDb/models/NoteDbModel';

export const convertDbToMemNoteBlock = async (
  dbModel: NoteBlockDbModel,
  noteId: string
) => {
  const children = await dbModel.childBlocks.fetch();

  return new NoteBlockMemModel({
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

export const convertDbToMemNote = async (dbModel: NoteDbModel) => {
  const noteBlockModels = await Promise.all(
    (await dbModel.noteBlocks.fetch()).map((m) =>
      convertDbToMemNoteBlock(m, dbModel.id)
    )
  );

  const noteModel = new NoteMemModel({
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
