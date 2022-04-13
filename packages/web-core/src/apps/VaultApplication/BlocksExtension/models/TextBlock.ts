import { ExtendedModel, model, modelAction, tProp, types } from 'mobx-keystone';

import { trackChanges } from '../../../../extensions/SyncExtension/mobx-keystone/trackChanges';
import { BaseBlock } from './BaseBlock';
import { TextBlockContent } from './TextBlockContentModel';

export const textBlockModelType = 'harika/BlocksExtension/TextBlock';

@trackChanges
@model(textBlockModelType)
export class TextBlock extends ExtendedModel(BaseBlock, {
  // It's a private field
  content: tProp(types.string),
}) {
  public contentModel!: TextBlockContent;

  // Should be used only in TextBlockContent
  @modelAction
  setContent(str: string) {
    this.content = str;
  }

  @modelAction
  mergeToAndDelete(to: BaseBlock) {
    if (to instanceof TextBlock) {
      to.content = to.content + this.contentModel.currentValue;
    }

    return super.mergeToAndDelete(to);
  }

  toString() {
    return this.content;
  }

  onInit() {
    this.contentModel = new TextBlockContent(this);
  }

  onAttachedToRootStore() {
    return this.contentModel.onAttachedToRootStore();
  }
}
