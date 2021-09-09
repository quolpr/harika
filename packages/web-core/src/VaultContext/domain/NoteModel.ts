import {
  model,
  Model,
  modelAction,
  prop,
  rootRef,
  tProp,
  types,
} from 'mobx-keystone';
import type { ModelCreationData } from 'mobx-keystone';

export interface INoteLoadStatus {
  areBlockLinksLoaded: boolean;
  areChildrenLoaded: boolean;
  areNoteLinksLoaded: boolean;
}

export const noteRef = rootRef<NoteModel>('harika/NoteRef');

const modelType = 'harika/NoteModel' as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNoteModel = (model: any): model is NoteModel =>
  '$modelType' in model && model.$modelType === modelType;

@model(modelType)
export class NoteModel extends Model({
  title: prop<string>(),
  dailyNoteDate: tProp(types.maybe(types.dateTimestamp)),
  updatedAt: tProp(types.dateTimestamp),
  createdAt: tProp(types.dateTimestamp),
  isDeleted: prop<boolean>(false),
  rootBlockId: prop<string>(),
}) {
  @modelAction
  updateTitle(newTitle: string) {
    this.title = newTitle;
  }

  updateAttrs(attrs: ModelCreationData<NoteModel>) {
    this.title = attrs.title;
    this.dailyNoteDate = attrs.dailyNoteDate;
    this.createdAt = attrs.createdAt;

    if (
      attrs.isDeleted !== undefined &&
      attrs.isDeleted !== null &&
      attrs.isDeleted !== this.isDeleted
    ) {
      this.isDeleted = attrs.isDeleted;
    }
  }
}
