import { idProp, Model, model, prop, Ref, tProp, types } from 'mobx-keystone';

import { syncable } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { BaseBlock } from './BaseBlock';

export const blockLinkModelType = 'harika/BlocksExtension/BlockLink';

@syncable
@model(blockLinkModelType)
export class BlockLink extends Model({
  id: idProp,
  blockRef: prop<Ref<BaseBlock>>(),
  linkedToBlockRef: prop<Ref<BaseBlock>>(),
  orderPosition: prop<number>(),
  createdAt: tProp(types.dateTimestamp),
  updatedAt: tProp(types.dateTimestamp),
}) {}
