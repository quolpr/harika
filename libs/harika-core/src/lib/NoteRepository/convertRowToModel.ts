import { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
import { NoteModel, noteRef } from './models/NoteModel';
import { NoteBlockRow } from './db/rows/NoteBlockRow';
import { NoteRow } from './db/rows/NoteRow';
import { Queries } from './db/Queries';
import { ModelInstanceCreationData } from 'mobx-keystone';
import { NoteLinkModel } from './models/NoteLinkModel';
import { NoteLinkRow } from './db/rows/NoteLinkRow';

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
    noteRef: noteRef(noteId),
    orderPosition: dbModel.orderPosition,
  };
};

interface IConvertResult {
  note: ModelInstanceCreationData<NoteModel> & { $modelId: string };
  noteBlocks: (ModelInstanceCreationData<NoteBlockModel> & {
    $modelId: string;
  })[];
  noteLinks: (ModelInstanceCreationData<NoteLinkModel> & {
    $modelId: string;
  })[];
  linkedNotes: IConvertResult[];
}

const mapLink = (
  row: NoteLinkRow
): ModelInstanceCreationData<NoteLinkModel> & {
  $modelId: string;
} => {
  return {
    $modelId: row.id,
    noteRef: noteRef(row.noteId),
    noteBlockRef: noteBlockRef(row.noteBlockId),
    createdAt: row.createdAt,
  };
};

export const convertNoteRowToModelAttrs = async (
  queries: Queries,
  dbModel: NoteRow,
  preloadChildren = true,
  preloadLinks = true
): Promise<IConvertResult> => {
  const links: (ModelInstanceCreationData<NoteLinkModel> & {
    $modelId: string;
    loatNoteOfBlock: boolean; // Actually it doesn't belong to model. Should be refactored
  })[] = [];

  const noteBlockAttrs = preloadChildren
    ? await Promise.all(
        (await dbModel.noteBlocks.fetch()).map((m) =>
          convertNoteBlockRowToModelAttrs(m, dbModel.id)
        )
      )
    : [];

  links.push(
    ...(preloadLinks
      ? (await dbModel.links.fetch()).map((row) => ({
          ...mapLink(row),
          loatNoteOfBlock: true,
        }))
      : [])
  );

  links.push(
    ...(
      await queries.getLinksByBlockIds(
        noteBlockAttrs.map(({ $modelId }) => $modelId)
      )
    ).map((row) => ({ ...mapLink(row), loatNoteOfBlock: false }))
  );

  const linkedNotes = (
    await Promise.all(
      links.map(async (link) => {
        const noteRow = await (async () => {
          if (link.loatNoteOfBlock) {
            return (
              await queries.getNoteBlockRowById(link.noteBlockRef.id)
            )?.note?.fetch();
          } else {
            return queries.getNoteRowById(link.noteRef.id);
          }
        })();

        const preloadNoteChildren = link.loatNoteOfBlock;

        return (
          noteRow &&
          convertNoteRowToModelAttrs(
            queries,
            noteRow,
            preloadNoteChildren,
            false
          )
        );
      })
    )
  ).filter(Boolean) as IConvertResult[];

  const noteModel = {
    $modelId: dbModel.id,
    title: dbModel.title,
    dailyNoteDate: dbModel.dailyNoteDate || new Date(),
    createdAt: dbModel.createdAt,
    areChildrenLoaded: preloadChildren,
    areLinksLoaded: preloadLinks,
  };

  return {
    note: noteModel,
    noteBlocks: noteBlockAttrs,
    linkedNotes,
    noteLinks: links,
  };
};
