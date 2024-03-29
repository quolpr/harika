import { computed } from 'mobx';
import {
  findParent,
  idProp,
  Model,
  model,
  modelAction,
  prop,
  Ref,
  rootRef,
} from 'mobx-keystone';

import { withoutUndoAction } from '../../../../lib/utils';
import {
  NotesTreeRegistry,
  notesTreeRegistryModelType,
} from './NotesTreeRegistry';

export const notesTreeNoteRef = rootRef<NotesTreeNote>(
  'harika/NotesTreeApp/noteRef',
);

@model('harika/NotesTreeApp/NotesTreeNote')
export class NotesTreeNote extends Model({
  id: idProp,
  title: prop<string>(),
  nodeRefs: prop<Ref<NotesTreeNote>[]>(() => []),
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
    return findParent<NotesTreeRegistry>(
      this,
      (obj) => (obj as any).$modelType === notesTreeRegistryModelType,
    )!;
  }

  @computed
  get fullTitle(): string {
    return [...this.path.slice(1), this].map(({ title }) => title).join('/');
  }

  @computed
  get parent() {
    return this.treeModel.parentIdsMap[this.$modelId];
  }

  @computed
  get path() {
    let parent = this.parent;
    const nodes: NotesTreeNote[] = [];

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

  @withoutUndoAction
  @modelAction
  setNoteId(noteId: string) {
    this.noteId = noteId;
  }

  @withoutUndoAction
  @modelAction
  removeFromParent() {
    this.parent.removeChildById(this.$modelId);
  }

  @withoutUndoAction
  @modelAction
  removeChildById(id: string) {
    this.nodeRefs = this.nodeRefs.filter((ref) => ref.id !== id);
  }

  @withoutUndoAction
  @modelAction
  toggleExpand() {
    this.isExpanded = !this.isExpanded;
  }
}
