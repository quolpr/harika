import { IMapper } from '../../../../extensions/SyncExtension/mappers';
import { BlocksTreeDescriptor } from '../models/BlocksTreeDescriptor';
import {
  BlocksTreeDescriptorDoc,
  blocksTreeDescriptorsTable,
} from '../repositories/BlockTreeDescriptorsRepository';

export const blocksTreeDescriptorsMapper: IMapper<
  BlocksTreeDescriptorDoc,
  BlocksTreeDescriptor
> = {
  mapToModelData(doc) {
    return {
      $modelId: doc.id,
      rootBlockId: doc.id,
    };
  },
  mapToDoc(model) {
    return {
      id: model.$modelId,
      rootBlockId: model.rootBlockId,
    };
  },
  tableName: blocksTreeDescriptorsTable,
  model: BlocksTreeDescriptor,
};
