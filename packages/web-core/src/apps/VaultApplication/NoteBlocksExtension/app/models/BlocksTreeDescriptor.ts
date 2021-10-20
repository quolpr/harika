import { Model, model, prop } from 'mobx-keystone';
import { syncable } from '../../../../../extensions/SyncExtension/app/mobx-keystone/syncable';

@syncable
@model('harika/noteBlocks/BlocksTreeDescriptor')
export class BlocksTreeDescriptor extends Model({
  rootBlockId: prop<string>(),
}) {}
