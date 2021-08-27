import { computed } from 'mobx';
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
import { NotesTreeModel, notesTreeModelType } from './NotesTreeModel';

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
  isExpanded: prop<boolean>(() => false),
}) {
  isInsideNode(noteId: string): boolean {
    if (noteId === this.noteId) return true;

    return Boolean(
      this.nodeRefs.find((nodeRef) => {
        return nodeRef.current.isInsideNode(noteId);
      }),
    );
  }

  @computed
  get hasNotes() {
    return this.nodeRefs.length !== 0;
  }

  @computed
  get sortedChildNodes() {
    return this.nodeRefs
      .map(({ current }) => current)
      .sort((a, b) => {
        if (a.hasNotes === b.hasNotes) {
          if (a.title > b.title) {
            return 1;
          }
          if (a.title < b.title) {
            return -1;
          }

          return 0;
        } else {
          return a.hasNotes ? -1 : 1;
        }
      });
  }

  @computed
  get treeModel() {
    return findParent<NotesTreeModel>(
      this,
      (obj) => (obj as any).$modelType === notesTreeModelType,
    )!;
  }

  @computed
  get fullTitle() {
    return [...this.path.slice(1), this].map(({ title }) => title).join('/');
  }

  @computed
  get parent() {
    return this.treeModel.parentIdsMap[this.$modelId];
  }

  @computed
  get path() {
    let parent = this.parent;
    const nodes: TreeNodeModel[] = [];

    while (parent) {
      nodes.push(parent);

      parent = parent.parent;
    }

    return nodes.reverse();
  }

  @computed
  get indent() {
    return this.path.length;
  }

  getChildWithTitle(title: string) {
    return this.nodeRefs.find((ref) => {
      return ref.current.title === title;
    });
  }

  @modelAction
  setNoteId(noteId: string) {
    this.noteId = noteId;
  }

  @modelAction
  removeFromParent() {
    this.parent.removeChildById(this.$modelId);
  }

  @modelAction
  removeChildById(id: string) {
    this.nodeRefs = this.nodeRefs.filter((ref) => ref.id !== id);
  }

  @modelAction
  toggleExpand() {
    this.isExpanded = !this.isExpanded;
  }
}
