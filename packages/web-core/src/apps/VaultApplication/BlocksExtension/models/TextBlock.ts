import { ExtendedModel, model, tProp, types } from 'mobx-keystone';
import { BaseBlock } from './BaseBlock';

export const textBlockModelType = 'harika/BlocksExtension/NoteBlock';
@model(textBlockModelType)
export class TextBlock extends ExtendedModel(BaseBlock, {
  content: tProp(types.string),
}) {
  toString() {
    return this.content;
  }
}
