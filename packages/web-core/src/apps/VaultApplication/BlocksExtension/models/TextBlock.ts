import { ExtendedModel, model, tProp, types } from 'mobx-keystone';
import { BaseBlock } from './BaseBlock';

@model('harika/BlocksExtension/TextBlockData')
export class TextBlock extends ExtendedModel(BaseBlock, {
  content: tProp(types.string),
}) {}
