import { computed } from 'mobx';
import { model, Model, modelAction, prop, Ref } from 'mobx-keystone';
import { withoutUndoAction } from '../../../utils';
import { notesTreeNoteRef, NotesTreeNote } from './NotesTreeNote';

export interface PartialNote {
  id: string;
  title: string;
}

export const notesTreeRegistryModelType =
  'harika/NotesTreeApp/NotesTreeRegistry' as const;

type INoteRename = {
  type: 'rename';
  id: string;
  toTitle: string;
};
type INoteDelete = { type: 'delete'; id: string };
type INewNote = { type: 'create'; id: string; title: string };

export type INoteTitleChange = INewNote | INoteDelete | INoteRename;

@model(notesTreeRegistryModelType)
export class NotesTreeRegistry extends Model({
  nodesMap: prop<Record<string, NotesTreeNote>>(() => ({})),
  rootNodeRef: prop<Ref<NotesTreeNote>>(),
  isInitialized: prop<boolean>(() => false),
}) {
  @computed
  get noteIdsMap(): Record<string, NotesTreeNote> {
    return Object.fromEntries(
      Object.values(this.nodesMap)
        .filter(({ noteId }) => noteId !== undefined)
        .map((node) => {
          return [node.noteId, node];
        }),
    );
  }

  @computed
  get parentIdsMap(): Record<string, NotesTreeNote> {
    return Object.fromEntries(
      Object.values(this.nodesMap).flatMap((parentNode) => {
        return parentNode.nodeRefs.map((nodeRef) => [
          nodeRef.current.$modelId,
          parentNode,
        ]);
      }),
    );
  }

  @withoutUndoAction
  @modelAction
  initializeTree(partialNotes: PartialNote[]): void {
    partialNotes.forEach(({ title: noteTitle, id }) => {
      this.insertNoteTitle(id, noteTitle);
    });

    this.isInitialized = true;
  }

  @withoutUndoAction
  @modelAction
  handleNotesChanges(changes: INoteTitleChange[]) {
    changes.forEach((ch) => {
      if (ch.type === 'create') {
        this.insertNoteTitle(ch.id, ch.title);
      }

      if (ch.type === 'delete') {
        if (!this.noteIdsMap[ch.id]) return;

        const node = this.nodesMap[this.noteIdsMap[ch.id].$modelId];
        node.noteId = undefined;

        this.deleteEmptyNodes();
      }

      if (ch.type === 'rename') {
        // TODO: could me optimized
        if (this.noteIdsMap[ch.id].$modelId) {
          const node = this.nodesMap[this.noteIdsMap[ch.id].$modelId];
          node.noteId = undefined;
        }

        this.insertNoteTitle(ch.id, ch.toTitle);

        this.deleteEmptyNodes();
      }
    });
  }

  insertNoteTitle(id: string, noteTitle: string) {
    let previousNode = this.rootNodeRef.current;

    const titles = noteTitle
      .split('/')
      .map((t) => t.trim())
      .filter((t) => t.length !== 0);

    titles.forEach((title, i) => {
      const node = this.findOrCreateNode(previousNode, title);

      if (i === titles.length - 1) {
        node.noteId = id;
      }

      previousNode = node;
    });
  }

  @withoutUndoAction
  @modelAction
  private deleteEmptyNodes() {
    Object.values(this.nodesMap).forEach((node) => {
      if (
        node.nodeRefs.length === 0 &&
        node.noteId === undefined &&
        this.rootNodeRef.id !== node.$modelId
      ) {
        this.removeNode(node.$modelId);
      }
    });
  }

  @withoutUndoAction
  @modelAction
  private removeNode(id: string) {
    const node = this.nodesMap[id];

    node.removeFromParent();

    delete this.nodesMap[node.$modelId];
  }

  private findOrCreateNode(parentNode: NotesTreeNote, title: string) {
    const foundNode = parentNode.getChildWithTitle(title);

    if (foundNode) return foundNode.current;

    const newNode = new NotesTreeNote({ title });

    this.nodesMap[newNode.$modelId] = newNode;

    parentNode.nodeRefs.push(notesTreeNoteRef(newNode));

    return newNode;
  }
}

export const newTreeModel = () => {
  const rootNode = new NotesTreeNote({ title: 'root' });
  return new NotesTreeRegistry({
    rootNodeRef: notesTreeNoteRef(rootNode),
    nodesMap: {
      [rootNode.$modelId]: rootNode,
    },
  });
};
