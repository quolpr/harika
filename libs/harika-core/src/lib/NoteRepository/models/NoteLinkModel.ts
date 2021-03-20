import {
  Model,
  model,
  modelAction,
  prop,
  Ref,
  tProp_dateTimestamp,
  types,
} from 'mobx-keystone';
import { NoteModel } from './NoteModel';
import { NoteBlockModel } from './NoteBlockModel';

@model('harika/NoteLinkModel')
export class NoteLinkModel extends Model({
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  noteRef: prop<Ref<NoteModel>>(),
  noteBlockRef: prop<Ref<NoteBlockModel>>(),
  isDeleted: prop<boolean>(false),
}) {
  @modelAction
  delete() {
    this.isDeleted = true;
  }
}
