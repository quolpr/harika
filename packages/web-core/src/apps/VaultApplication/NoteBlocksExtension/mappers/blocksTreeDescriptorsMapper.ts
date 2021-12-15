import { IMapper } from '../../../../extensions/SyncExtension/mappers';
import { generateId } from '../../../../lib/generateId';
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
      $modelId: generateId(),
      rootBlockId: doc.rootBlockId,
      noteId: doc.id,
    };
  },
  mapToDoc(model) {
    return {
      id: model.noteId,
      rootBlockId: model.rootBlockId,
    };
  },
  collectionName: blocksTreeDescriptorsTable,
  model: BlocksTreeDescriptor,
};
