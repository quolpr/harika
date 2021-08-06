import { computed } from 'mobx';
import { model, Model, modelAction, prop, Ref } from 'mobx-keystone';
import { nodeRef, TreeNodeModel } from './TreeNodeModel';

export interface PartialNote {
  id: string;
  title: string;
}

export const notesTreeModelType = 'harika/NotesTreeModel' as const;

type INoteRename = {
  type: 'rename';
  id: string;
  toTitle: string;
};
type INoteDelete = { type: 'delete'; id: string };
type INewNote = { type: 'create'; id: string; title: string };

export type INoteTitleChange = INewNote | INoteDelete | INoteRename;

@model(notesTreeModelType)
export class NotesTreeModel extends Model({
  nodesMap: prop<Record<string, TreeNodeModel>>(() => ({})),
  rootNodeRef: prop<Ref<TreeNodeModel>>(),
  isInitialized: prop<boolean>(() => false),
}) {
  @computed
  get noteIdsMap(): Record<string, TreeNodeModel> {
    return Object.fromEntries(
      Object.values(this.nodesMap)
        .filter(({ noteId }) => noteId !== undefined)
        .map((node) => {
          return [node.noteId, node];
        }),
    );
  }

  @computed
  get parentIdsMap(): Record<string, TreeNodeModel> {
    return Object.fromEntries(
      Object.values(this.nodesMap).flatMap((parentNode) => {
        return parentNode.nodeRefs.map((nodeRef) => [
          nodeRef.current.$modelId,
          parentNode,
        ]);
      }),
    );
  }

  @modelAction
  initializeTree(partialNotes: PartialNote[]): void {
    partialNotes.forEach(({ title: noteTitle, id }) => {
      this.insertNoteTitle(id, noteTitle);
    });

    this.cleanRootNotes();

    this.isInitialized = true;
  }

  @modelAction
  handleNotesChanges(changes: INoteTitleChange[]) {
    changes.forEach((ch) => {
      if (ch.type === 'create') {
        this.insertNoteTitle(ch.id, ch.title);

        this.cleanRootNotes();
      }

      if (ch.type === 'delete') {
        this.removeNode(this.noteIdsMap[ch.id].$modelId);
        this.deleteEmptyNodes();
      }

      if (ch.type === 'rename') {
        // TODO: could me optimized

        this.removeNode(this.noteIdsMap[ch.id].$modelId);
        this.insertNoteTitle(ch.id, ch.toTitle);

        this.deleteEmptyNodes();
        this.cleanRootNotes();
      }
    });
  }

  @modelAction
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

  @modelAction
  private removeNode(id: string) {
    const node = this.nodesMap[id];

    node.removeFromParent();

    delete this.nodesMap[node.$modelId];
  }

  @modelAction
  private cleanRootNotes() {
    const rootNode = this.rootNodeRef.current;

    rootNode.nodeRefs = rootNode.nodeRefs.filter(
      (nodeRef) => nodeRef.current.nodeRefs.length !== 0,
    );
  }

  private findOrCreateNode(parentNode: TreeNodeModel, title: string) {
    const foundNode = parentNode.getChildWithTitle(title);

    if (foundNode) return foundNode.current;

    const newNode = new TreeNodeModel({ title });

    this.nodesMap[newNode.$modelId] = newNode;

    parentNode.nodeRefs.push(nodeRef(newNode));

    return newNode;
  }
}

export const newTreeModel = () => {
  const rootNode = new TreeNodeModel({ title: 'root' });
  return new NotesTreeModel({
    rootNodeRef: nodeRef(rootNode),
    nodesMap: {
      [rootNode.$modelId]: rootNode,
    },
  });
};
