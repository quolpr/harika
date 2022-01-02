import { ExtendedModel, model, tProp, types } from 'mobx-keystone';
import { BaseBlock } from './BaseBlock';

@model('harika/BlocksExtension/NoteBlock')
export class NoteBlock extends ExtendedModel(BaseBlock, {
  type: tProp(types.literal('noteBlock')),
  title: tProp(types.string),
  dailyNoteDate: tProp(types.maybe(types.dateTimestamp)),
}) {}
