import {
  detach,
  model,
  Model,
  modelAction,
  ModelCreationData,
  prop,
  tProp,
  types,
} from 'mobx-keystone';
import { syncable } from '../../../../../extensions/SyncExtension/app/mobx-keystone/syncable';

export interface INoteLoadStatus {
  areBlockLinksLoaded: boolean;
  areChildrenLoaded: boolean;
  areNoteLinksLoaded: boolean;
}

export const noteModelType = 'harika/NoteModel' as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNoteModel = (model: any): model is NoteModel =>
  '$modelType' in model && model.$modelType === noteModelType;

@syncable
@model(noteModelType)
export class NoteModel extends Model({
  title: prop<string>(),
  dailyNoteDate: tProp(types.maybe(types.dateTimestamp)),
  updatedAt: tProp(types.dateTimestamp),
  createdAt: tProp(types.dateTimestamp),
}) {
  @modelAction
  updateTitle(newTitle: string) {
    this.title = newTitle;
  }

  @modelAction
  delete() {
    detach(this);
  }

  updateAttrs(attrs: ModelCreationData<NoteModel>) {
    this.title = attrs.title;
    this.dailyNoteDate = attrs.dailyNoteDate;
    this.createdAt = attrs.createdAt;
  }
}
