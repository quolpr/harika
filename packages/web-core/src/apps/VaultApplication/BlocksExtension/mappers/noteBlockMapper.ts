import { IMapper } from '../../../../extensions/SyncExtension/mappers';
import { blockRef } from '../models/BaseBlock';
import { NoteBlock, noteBlockModelType } from '../models/NoteBlock';
import {
  NoteBlockDoc,
  noteBlocksTable,
} from '../repositories/NoteBlocksRepostitory';

export const noteBlockMapper: IMapper<NoteBlockDoc, NoteBlock> = {
  mapToModelData(doc) {
    return {
      id: doc.id,
      $modelType: noteBlockModelType,

      parentRef: doc.parentId ? blockRef(doc.parentId) : undefined,
      orderPosition: doc.orderPosition,

      title: doc.title,
      dailyNoteDate: doc.dailyNoteDate ? doc.dailyNoteDate : undefined,

      areChildrenLoaded: true,

      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  },
  mapToDoc(model) {
    return {
      id: model.id,
      type: 'noteBlock',

      orderPosition: model.orderPosition,
      parentId: model.parentRef?.id,

      title: model.title,
      dailyNoteDate: model.dailyNoteDate ? model.dailyNoteDate : null,

      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  },
  collectionName: noteBlocksTable,
  model: NoteBlock,
};
