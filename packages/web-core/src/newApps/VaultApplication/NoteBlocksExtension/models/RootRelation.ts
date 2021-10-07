import { Model, model, prop } from 'mobx-keystone';
import { syncable } from '../../../../apps/VaultApp/utils/syncable';

@model('harika/noteBlocks/RootRelation')
@syncable
export class RootRelation extends Model({
  noteId: prop<string>(),
  rootBlockId: prop<string>(),
}) {}
