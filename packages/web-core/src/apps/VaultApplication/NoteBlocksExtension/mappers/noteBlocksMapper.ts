import { IMapper } from '../../../../extensions/SyncExtension/mappers';
import { BlockContentModel } from '../models/BlockContentModel';
import { NoteBlockModel, noteBlockRef } from '../models/NoteBlockModel';
import {
  NoteBlockDoc,
  noteBlocksTable,
} from '../repositories/NotesBlocksRepository';

export const noteBlocksMapper: IMapper<NoteBlockDoc, NoteBlockModel> = {
  mapToModelData(doc) {
    return {
      $modelId: doc.id,
      content: new BlockContentModel({ _value: doc.content }),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      noteId: doc.noteId,
      noteBlockRefs: doc.noteBlockIds
        .filter((v) => Boolean(v))
        .map((id) => noteBlockRef(id)),
      linkedNoteIds: doc.linkedNoteIds.filter((v) => Boolean(v)),
      linkedBlockIds: doc.linkedBlockIds.filter((v) => Boolean(v)),
    };
  },
  mapToDoc(model) {
    return {
      id: model.$modelId,
      noteId: model.noteId,
      content: model.content._value,
      createdAt: model.createdAt,
      noteBlockIds: model.noteBlockRefs.map(({ id }) => id),
      linkedNoteIds: [...model.linkedNoteIds],
      linkedBlockIds: [...model.linkedBlockIds],
      updatedAt: model.updatedAt,
    };
  },
  collectionName: noteBlocksTable,
  model: NoteBlockModel,
};
