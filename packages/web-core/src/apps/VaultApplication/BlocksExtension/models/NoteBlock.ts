import { computed } from 'mobx';
import { ExtendedModel, model, tProp, types } from 'mobx-keystone';
import { syncable } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { BaseBlock } from './BaseBlock';

export const noteBlockModelType = 'harika/BlocksExtension/NoteBlock';

@syncable
@model(noteBlockModelType)
export class NoteBlock extends ExtendedModel(BaseBlock, {
  title: tProp(types.string),
  dailyNoteDate: tProp(types.maybe(types.dateTimestamp)),
}) {
  @computed
  get parent(): undefined {
    return undefined;
  }

  toString() {
    return this.title;
  }
}
