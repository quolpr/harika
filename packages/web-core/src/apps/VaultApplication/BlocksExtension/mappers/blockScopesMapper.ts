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
      id: doc.id,
      $modelType: blocksScopeType,
      collapsedBlockIds: arraySet(doc.collapsedBlockIds),
      scopeId: doc.scopeId,
      scopeType: doc.scopeType,
      rootBlockId: doc.rootBlockId,
      selectionInterval: undefined,
      prevSelectionInterval: undefined,
      addableSelectionId: undefined,
    };
  },
  mapToDoc(model) {
    return {
      id: model.id,
      collapsedBlockIds: Array.from(model.collapsedBlockIds),
      scopeId: model.scopeId,
      scopeType: model.scopeType,
      rootBlockId: model.rootBlockId,
    };
  },
  collectionName: blocksScopesTable,
  model: BlocksScope,
};
