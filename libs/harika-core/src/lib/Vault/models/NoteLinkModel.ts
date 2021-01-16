import {
  Model,
  model,
  modelAction,
  prop,
  Ref,
  tProp_dateTimestamp,
  types,
} from 'mobx-keystone';
import { NoteBlockModel, NoteModel } from '../../Vault';

@model('harika/NoteLinkModel')
export class NoteLinkModel extends Model({
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  noteRef: prop<Ref<NoteModel>>(),
  noteBlockRef: prop<Ref<NoteBlockModel>>(),
  isDeleted: prop<boolean>(false),
}) {
  @modelAction
  markAsDeleted() {
    this.isDeleted = true;
  }
}
