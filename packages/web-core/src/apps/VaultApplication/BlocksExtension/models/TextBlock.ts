import { ExtendedModel, model, modelAction, tProp, types } from 'mobx-keystone';
import { BaseBlock } from './BaseBlock';

export const textBlockModelType = 'harika/BlocksExtension/NoteBlock';
@model(textBlockModelType)
export class TextBlock extends ExtendedModel(BaseBlock, {
  content: tProp(types.string),
}) {
  @modelAction
  setContent(str: string) {
    this.content = str;
  }

  @modelAction
  mergeToAndDelete(to: BaseBlock) {
    if (to instanceof TextBlock) {
      to.content = to.content + this.content;
    }

    return super.mergeToAndDelete(to);
  }

  toString() {
    return this.content;
  }
}
