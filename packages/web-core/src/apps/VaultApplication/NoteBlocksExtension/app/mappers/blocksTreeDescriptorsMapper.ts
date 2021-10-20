import { IMapper } from '../../../../../extensions/SyncExtension/app/mappers';
import { BlocksTreeDescriptor } from '../models/BlocksTreeDescriptor';
import {
  BlocksTreeDescriptorDoc,
  blocksTreeDescriptorsTable,
} from '../../worker/repositories/BlockTreeDescriptorsRepository';

export const blocksTreeDescriptorsMapper: IMapper<
  BlocksTreeDescriptorDoc,
  BlocksTreeDescriptor
> = {
  mapToModelData(doc) {
    return {
      $modelId: doc.id,
      rootBlockId: doc.rootBlockId,
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
