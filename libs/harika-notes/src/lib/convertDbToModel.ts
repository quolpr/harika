import {
  NoteBlockMemModel,
  noteBlockRef,
} from './MemoryDb/models/NoteBlockMemModel';
import { NoteMemModel } from './MemoryDb/models/NoteMemModel';
import { NoteBlockDbModel } from './PersistentDb/models/NoteBlockDbModel';
import { NoteDbModel } from './PersistentDb/models/NoteDbModel';

export const convertDbToMemNoteBlock = (dbModel: NoteBlockDbModel) => {
  return new NoteBlockMemModel({
    $modelId: dbModel.id,
    content: dbModel.content,
    updatedAt: dbModel.updatedAt,
    createdAt: dbModel.createdAt,
  });
};

export const convertDbToMemNote = async (dbModel: NoteDbModel) => {
  const noteBlockModels = (await dbModel.noteBlocks.fetch()).map(
    convertDbToMemNoteBlock
  );

  const noteModel = new NoteMemModel({
    $modelId: dbModel.id,
    title: dbModel.title,
    dailyNoteDate: dbModel.dailyNoteDate || new Date(),
    updatedAt: dbModel.updatedAt,
    createdAt: dbModel.createdAt,
    blocksMap: Object.fromEntries(noteBlockModels.map((m) => [m.$modelId, m])),
    childBlockRefs: noteBlockModels.map((m) => noteBlockRef(m)),
  });

  return { note: noteModel, noteBlocks: noteBlockModels };
};
