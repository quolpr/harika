import { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
import { NoteModel, noteRef } from './models/NoteModel';
import { NoteBlockRow } from './db/rows/NoteBlockRow';
import { NoteRow } from './db/rows/NoteRow';
import { Queries } from './db/Queries';
import { ModelInstanceCreationData } from 'mobx-keystone';

export const convertNoteBlockRowToModelAttrs = async (
  dbModel: NoteBlockRow,
  noteId: string
) => {
  return {
    $modelId: dbModel.id,
    content: dbModel.content,
    createdAt: dbModel.createdAt,
    parentBlockRef: dbModel.parentBlockId
      ? noteBlockRef(dbModel.parentBlockId)
      : undefined,
    isPersisted: true,
    noteRef: noteRef(noteId),
    linkedNoteRefs: (dbModel.linkedNoteIds || []).map((id) => noteRef(id)),
    orderPosition: dbModel.orderPosition,
  };
};

interface IConvertResult {
  note: ModelInstanceCreationData<NoteModel> & { $modelId: string };
  noteBlocks: (ModelInstanceCreationData<NoteBlockModel> & {
    $modelId: string;
  })[];
  linkedNotes: IConvertResult[];
}

export const convertNoteRowToModelAttrs = async (
  queries: Queries,
  dbModel: NoteRow,
  preloadChildren = true,
  preloadLinks = true
): Promise<IConvertResult> => {
  const noteBlockAttrs = preloadChildren
    ? await Promise.all(
        (await dbModel.noteBlocks.fetch()).map((m) =>
          convertNoteBlockRowToModelAttrs(m, dbModel.id)
        )
      )
    : [];

  const linkedNotes = preloadLinks
    ? await Promise.all(
        (
          await queries.getNoteRowsOfNoteBlockIds(
            dbModel.linkedNoteBlockIds || []
          )
        ).map((row) => convertNoteRowToModelAttrs(queries, row, true, false))
      )
    : [];

  const linkedNoteBlockRefs = preloadLinks
    ? (dbModel.linkedNoteBlockIds || []).map((noteBlockId) =>
        noteBlockRef(noteBlockId)
      )
    : [];

  const noteModel = {
    $modelId: dbModel.id,
    title: dbModel.title,
    dailyNoteDate: dbModel.dailyNoteDate || new Date(),
    createdAt: dbModel.createdAt,
    isPersisted: true,
    areChildrenLoaded: preloadChildren,
    linkedNoteBlockRefs: linkedNoteBlockRefs,
    areLinksLoaded: preloadLinks,
  };

  await Promise.all(
    noteBlockAttrs.map(async (attr) => {
      await Promise.all(
        attr.linkedNoteRefs.map(async (ref) => {
          if (!linkedNotes.find(({ note }) => note.$modelId === ref.id)) {
            linkedNotes.push(
              await convertNoteRowToModelAttrs(
                queries,
                await queries.getNoteRowById(ref.id),
                false,
                false
              )
            );
          }
        })
      );
    })
  );

  return { note: noteModel, noteBlocks: noteBlockAttrs, linkedNotes };
};
