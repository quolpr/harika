import { IMapper } from '../../../../extensions/SyncExtension/mappers';
import { blockRef } from '../models/BaseBlock';
import { TextBlock, textBlockModelType } from '../models/TextBlock';
import {
  TextBlockDoc,
  textBlocksTable,
} from '../repositories/TextBlocksRepository';

export const textBlockMapper: IMapper<TextBlockDoc, TextBlock> = {
  mapToModelData(doc) {
    return {
      id: doc.id,
      $modelType: textBlockModelType,

      parentRef: doc.parentId ? blockRef(doc.parentId) : undefined,
      orderPosition: doc.orderPosition,
      linkedBlockRefs: doc.linkedBlockIds.map((id) => blockRef(id)),

      content: doc.content,

      areChildrenLoaded: true,

      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  },
  mapToDoc(model) {
    return {
      id: model.id,
      type: 'textBlock',

      orderPosition: model.orderPosition,
      parentId: model.parentRef?.id,
      linkedBlockIds: model.linkedBlockRefs.map(({ id }) => id),

      content: model.content,

      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  },
  collectionName: textBlocksTable,
  model: TextBlock,
};
