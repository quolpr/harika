import { computed } from 'mobx';
import { ExtendedModel, model, tProp, types } from 'mobx-keystone';
import { BaseBlock } from './BaseBlock';

@model('harika/BlocksExtension/NoteBlock')
export class NoteBlock extends ExtendedModel(BaseBlock, {
  title: tProp(types.string),
  dailyNoteDate: tProp(types.maybe(types.dateTimestamp)),
}) {
  @computed
  get parent(): undefined {
    return undefined;
  }
}
