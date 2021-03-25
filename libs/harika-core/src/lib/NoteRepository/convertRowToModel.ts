import { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
import { NoteModel, noteRef } from './models/NoteModel';
import { ModelInstanceCreationData } from 'mobx-keystone';
import { NoteLinkModel } from './models/NoteLinkModel';
import { NoteDocument } from './rxdb/NoteRx';
import { NoteBlockDocument } from './rxdb/NoteBlockRx';
import { HarikaRxDatabase } from './rxdb/initDb';
import { NoteLinkRxDocument } from './rxdb/NoteLinkRx';

export const convertNoteBlockRowToModelAttrs = async (
  dbModel: NoteBlockDocument,
  noteId: string
) => {
  return {
    $modelId: dbModel._id,
    content: dbModel.content,
    createdAt: new Date(dbModel.createdAt),
    parentBlockRef: dbModel.parentBlock
      ? noteBlockRef(dbModel.parentBlock)
      : undefined,
    noteRef: noteRef(noteId),
    noteBlockRefs: dbModel.noteBlocks.map((b) => noteBlockRef(b)),
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
  row: NoteLinkRxDocument
): ModelInstanceCreationData<NoteLinkModel> & {
  $modelId: string;
} => {
  return {
    $modelId: row._id,
    noteRef: noteRef(row.note),
    noteBlockRef: noteBlockRef(row.noteBlock),
    createdAt: new Date(row.createdAt),
  };
};

export const convertNoteRowToModelAttrs = async (
  db: HarikaRxDatabase,
  dbModel: NoteDocument,
  preloadChildren = true,
  preloadLinks = true
): Promise<IConvertResult> => {
  const links: (ModelInstanceCreationData<NoteLinkModel> & {
    $modelId: string;
    loatNoteOfBlock: boolean; // Actually it doesn't belong to model. Should be refactored
  })[] = [];

  const noteBlockAttrs = preloadChildren
    ? await Promise.all(
        (await dbModel.getNoteBlocks()).map((m) =>
          convertNoteBlockRowToModelAttrs(m, dbModel._id)
        )
      )
    : [];

  console.log({ noteBlockAttrs, preloadChildren });

  links.push(
    ...(preloadLinks
      ? (await dbModel.getLinks()).map((row) => ({
          ...mapLink(row),
          loatNoteOfBlock: true,
        }))
      : [])
  );

  links.push(
    ...(
      await db.notelinks.getLinksByBlockIds(
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
              await db.noteblocks.getById(link.noteBlockRef.id)
            )?.getNote();
          } else {
            return db.notes.getNoteById(link.noteRef.id);
          }
        })();

        const preloadNoteChildren = link.loatNoteOfBlock;

        return (
          noteRow &&
          convertNoteRowToModelAttrs(db, noteRow, preloadNoteChildren, false)
        );
      })
    )
  ).filter(Boolean) as IConvertResult[];

  const noteModel = {
    $modelId: dbModel._id,
    title: dbModel.title,
    dailyNoteDate: dbModel.dailyNoteDate
      ? new Date(dbModel.dailyNoteDate)
      : new Date(),
    createdAt: new Date(dbModel.createdAt),
    areChildrenLoaded: preloadChildren,
    areLinksLoaded: preloadLinks,
    noteBlockRefs: dbModel.noteBlocks.map((id) => noteBlockRef(id)),
  };

  return {
    note: noteModel,
    noteBlocks: noteBlockAttrs,
    linkedNotes,
    noteLinks: links,
  };
};
