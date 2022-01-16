import { IMapper } from '../../../../extensions/SyncExtension/mappers';
import { blockRef } from '../models/BaseBlock';
import { NoteBlock, noteBlockModelType } from '../models/NoteBlock';
import {
  NoteBlockDoc,
  noteBlocksTable,
} from '../repositories/NoteBlocksRepostitory';

export const notesMapper: IMapper<NoteBlockDoc, NoteBlock> = {
  mapToModelData(doc) {
    return {
      $modelId: doc.id,
      $modelType: noteBlockModelType,

      parentRef: doc.parentId ? blockRef(doc.parentId) : undefined,
      orderPosition: doc.orderPosition,
      linkedBlockRefs: doc.linkedBlockIds.map((id) => blockRef(id)),

      title: doc.title,
      dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : undefined,

      areChildrenLoaded: false,

      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  },
  mapToDoc(model) {
    return {
      id: model.$modelId,
      type: 'noteBlock',

      orderPosition: model.orderPosition,
      parentId: model.parentRef?.id,
      linkedBlockIds: model.linkedBlockRefs.map(({ id }) => id),

      title: model.title,
      dailyNoteDate: model.dailyNoteDate ? model.dailyNoteDate : null,

      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  },
  collectionName: noteBlocksTable,
  model: NoteBlock,
};
