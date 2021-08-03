import { Model, model, prop, Ref } from 'mobx-keystone';

@model('harika/TagNode')
export class TagsTreeModel extends Model({
  title: prop<string>(),
  nodes: prop<Ref<TagsTreeModel>[]>(),
}) {}
