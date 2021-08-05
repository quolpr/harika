import {
  customRef,
  detach,
  findParent,
  Model,
  model,
  modelAction,
  prop,
  Ref,
} from 'mobx-keystone';
import { isNotesTree } from '../utils';
import type { NotesTreeModel } from './NotesTreeModel';

export const nodeRef = customRef<TreeNodeModel>('harika/NotesTree/nodeRef', {
  resolve(ref) {
    const notesTree = findParent<NotesTreeModel>(this, isNotesTree);

    if (!notesTree) {
      return undefined;
    }

    return notesTree.nodesMap[ref.id];
  },

  onResolvedValueChange(ref, newTodo, oldTodo) {
    if (oldTodo && !newTodo) {
      // if the todo value we were referencing disappeared then remove the reference
      // from its parent
      detach(ref);
    }
  },
});

@model('harika/NotesTree/TreeNodeModel')
export class TreeNodeModel extends Model({
  title: prop<string>(),
  nodeRefs: prop<Ref<TreeNodeModel>[]>(() => []),
  noteId: prop<string | undefined>(() => undefined),
  isExpanded: prop<boolean>(() => true),
}) {
  get isFocused() {
    return this.title === 'Я';
  }

  getChildWithTitle(title: string) {
    return this.nodeRefs.find((ref) => {
      return ref.current.title === title;
    });
  }

  @modelAction
  toggleExpand() {
    this.isExpanded = !this.isExpanded;
  }
}
