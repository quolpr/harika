import {
  model,
  Model,
  modelAction,
  ModelCreationData,
  prop,
} from 'mobx-keystone';
import { Subject } from 'rxjs';
import {
  ISyncableModelChange,
  syncChangesCtx,
  withoutSyncAction,
} from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';
import { generateId } from '../../../../lib/generateId';
import { withoutUndoAction } from '../../../../lib/utils';
import { NoteModel } from './NoteModel';

@model('harika/notesStore')
export class NotesStore extends Model({
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
}) {
  @modelAction
  createNote(data: ModelCreationData<NoteModel>) {
    const $modelId = data.$modelId || generateId();

    this.notesMap[$modelId] = new NoteModel({ ...data, $modelId });

    return this.notesMap[$modelId];
  }

  @modelAction
  registerNote(model: NoteModel) {
    this.notesMap[model.$modelId] = model;
  }

  getNote(id: string) {
    return this.notesMap[id];
  }

  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleChanges(
    notesAttrs: (ModelCreationData<NoteModel> & {
      $modelId: string;
    })[],
    deletedIds: SyncModelId<NoteModel>[],
  ) {
    deletedIds.forEach((id) => {
      delete this.notesMap[id.value];
    });

    notesAttrs.forEach((attr) => {
      if (!this.getNote(attr.$modelId)) {
        this.createNote(attr);
      } else {
        this.getNote(attr.$modelId).updateAttrs(attr);
      }
    });
  }
}
