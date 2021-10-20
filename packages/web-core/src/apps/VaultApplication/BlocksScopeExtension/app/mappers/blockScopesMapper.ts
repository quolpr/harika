import { arraySet } from 'mobx-keystone';
import { IMapper } from '../../../../../extensions/SyncExtension/app/mappers';
import { blocksRegistryRef } from '../../../NoteBlocksExtension/app/models/BlockModelsRegistry';
import { BlocksScope } from '../models/BlocksScope';
import {
  BlocksScopeDoc,
  blocksScopesTable,
} from '../../worker/repositories/BlockScopesRepository';

export const blocksScopesMapper: IMapper<BlocksScopeDoc, BlocksScope> = {
  mapToModelData(doc) {
    return {
      $modelId: doc.id,
      blocksRegistryRef: blocksRegistryRef(doc.noteId),
      collapsedBlockIds: arraySet(doc.collapsedBlockIds),
      noteId: doc.noteId,
      scopedModelId: doc.scopedModelId,
      scopedModelType: doc.scopedModelType,
      rootScopedBlockId: doc.rootBlockId,
    };
  },
  mapToDoc(model) {
    return {
      id: model.$modelId,
      collapsedBlockIds: Array.from(model.collapsedBlockIds),
      noteId: model.noteId,
      scopedModelId: model.scopedModelId,
      scopedModelType: model.scopedModelType,
      rootBlockId: model.rootScopedBlockId,
    };
  },
  tableName: blocksScopesTable,
  model: BlocksScope,
};
