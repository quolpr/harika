import { model, Model, prop, tProp, types, Ref } from 'mobx-keystone';

interface PartialNote {
  id: string;
  title: string;
}

@model('harika/TagsTree')
export class TagsTreeModel extends Model({
  nodes: prop<Record<string, TagsTreeModel>>(),
  rootNode: prop<Ref<TagsTreeModel>>(),
}) {
  parsedToTree(partialNotes: PartialNote[]) {}
}
