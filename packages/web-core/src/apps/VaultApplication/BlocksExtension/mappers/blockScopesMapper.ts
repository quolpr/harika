import { arraySet } from 'mobx-keystone';
import { IMapper } from '../../../../extensions/SyncExtension/mappers';
import { BlocksScope, blocksScopeType } from '../models/BlocksScope';
import {
  BlocksScopeDoc,
  blocksScopesTable,
} from '../repositories/BlockScopesRepository';

export const blocksScopesMapper: IMapper<BlocksScopeDoc, BlocksScope> = {
  mapToModelData(doc) {
    return {
      $modelId: doc.id,
      $modelType: blocksScopeType,
      collapsedBlockIds: arraySet(doc.collapsedBlockIds),
      scopedId: doc.scopedModelId,
      scopedType: doc.scopedModelType,
      rootBlockId: doc.rootBlockId,
    };
  },
  mapToDoc(model) {
    return {
      id: model.$modelId,
      collapsedBlockIds: Array.from(model.collapsedBlockIds),
      scopedModelId: model.scopedId,
      scopedModelType: model.scopedType,
      rootBlockId: model.rootBlockId,
    };
  },
  collectionName: blocksScopesTable,
  model: BlocksScope,
};
