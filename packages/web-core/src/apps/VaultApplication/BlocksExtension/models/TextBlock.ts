import { ExtendedModel, model, modelAction, tProp, types } from 'mobx-keystone';
import { syncable } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { BaseBlock } from './BaseBlock';
import { TextBlockContent } from './TextBlockContentModel';

export const textBlockModelType = 'harika/BlocksExtension/NoteBlock';

@syncable
@model(textBlockModelType)
export class TextBlock extends ExtendedModel(BaseBlock, {
  content: tProp(types.string),
}) {
  public contentModel!: TextBlockContent;

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

  onInit() {
    this.contentModel = new TextBlockContent(this);
  }
}
