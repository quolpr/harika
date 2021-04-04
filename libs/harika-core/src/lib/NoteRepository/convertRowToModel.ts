import { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
import { NoteModel, noteRef } from './models/NoteModel';
import { ModelInstanceCreationData } from 'mobx-keystone';
import { NoteDocument } from './rxdb/NoteRx';
import { NoteBlockDocument } from './rxdb/NoteBlockDb';
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
    parentBlockRef: dbModel.parentBlockRef
      ? noteBlockRef(dbModel.parentBlockRef)
      : undefined,
    noteRef: noteRef(dbModel.noteRef),
    noteBlockRefs: dbModel.noteBlockRefs.map((b) => noteBlockRef(b)),
    linkedNoteRefs: dbModel.linkedNoteRefs.map((n) => noteRef(n)),
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
    rootBlockRef: noteBlockRef(dbModel.rootBlockRef),
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

  // linkedBlocks.push(
  //   ...(preloadLinks
  //     ? (await dbModel.getLinkedBlocks()).map((row) => ({
  //         noteblock: convertNoteBlockRowToModelAttrs(row),
  //         loatNoteOfBlock: true,
  //       }))
  //     : [])
  // );

  // linkedBlocks.push(
  //   ...(
  //     await db.notelinks.getLinksByBlockIds(
  //       noteBlockAttrs.map(({ $modelId }) => $modelId)
  //     )
  //   ).map((row) => ({ ...mapLink(row), loatNoteOfBlock: false }))
  // );

  // const linkedNotes = (
  //   await Promise.all(
  //     linkedBlocks.map(async (link) => {
  //       const noteRow = await (async () => {
  //         if (link.loatNoteOfBlock) {
  //           return (
  //             await db.noteblocks.getById(link.noteBlockRef.id)
  //           )?.getNote();
  //         } else {
  //           return db.notes.getNoteById(link.noteRef.id);
  //         }
  //       })();

  //       const preloadNoteChildren = link.loatNoteOfBlock;

  //       return (
  //         noteRow &&
  //         convertNoteRowToModelAttrs(db, noteRow, preloadNoteChildren, false)
  //       );
  //     })
  //   )
  // ).filter(Boolean) as IConvertResult[];

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
