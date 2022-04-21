import { IMapper } from '../../../../extensions/SyncExtension/mappers';
import { blockRef } from '../../BlocksExtension/models/BaseBlock';
import { BlockLink, blockLinkModelType } from '../models/BlockLink';
import {
  BlockLinkDoc,
  blockLinksTable,
} from '../repositories/BlockLinkRepository';

export const blockLinkMapper: IMapper<BlockLinkDoc, BlockLink> = {
  mapToModelData(doc) {
    return {
      id: doc.id,
      $modelType: blockLinkModelType,

      blockRef: blockRef(doc.blockId),
      linkedToBlockRef: blockRef(doc.linkedToBlockId),
      orderPosition: doc.orderPosition,

      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  },
  mapToDoc(model) {
    return {
      id: model.id,

      blockId: model.blockRef.id,
      linkedToBlockId: model.linkedToBlockRef.id,
      orderPosition: model.orderPosition,

      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  },
  collectionName: blockLinksTable,
  model: BlockLink,
};
