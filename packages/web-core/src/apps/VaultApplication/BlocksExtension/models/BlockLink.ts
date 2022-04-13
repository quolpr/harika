import { idProp, Model, model, prop, Ref, tProp, types } from 'mobx-keystone';

import { trackChanges } from '../../../../extensions/SyncExtension/mobx-keystone/trackChanges';
import { BaseBlock } from './BaseBlock';

export const blockLinkModelType = 'harika/BlocksExtension/BlockLink';

@trackChanges
@model(blockLinkModelType)
export class BlockLink extends Model({
  id: idProp,
  blockRef: prop<Ref<BaseBlock>>(),
  linkedToBlockRef: prop<Ref<BaseBlock>>(),
  orderPosition: prop<number>(),
  createdAt: tProp(types.dateTimestamp),
  updatedAt: tProp(types.dateTimestamp),
}) {}
