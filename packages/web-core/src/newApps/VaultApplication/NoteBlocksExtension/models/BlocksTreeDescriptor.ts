import { Model, model, prop } from 'mobx-keystone';
import { syncable } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';

@model('harika/noteBlocks/BlocksTreeDescriptor')
@syncable
export class BlocksTreeDescriptor extends Model({
  rootBlockId: prop<string>(),
}) {}
