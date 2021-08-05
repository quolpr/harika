import { model, Model, modelAction, prop, Ref } from 'mobx-keystone';
import type { INoteChangeEvent } from '../../../dexieTypes';
import { nodeRef, TreeNodeModel } from './TreeNodeModel';

export interface PartialNote {
  id: string;
  title: string;
}

export const notesTreeModelType = 'harika/NotesTreeModel' as const;

@model(notesTreeModelType)
export class NotesTreeModel extends Model({
  nodesMap: prop<Record<string, TreeNodeModel>>(() => ({})),
  rootNodeRef: prop<Ref<TreeNodeModel>>(),
  isInitialized: prop<boolean>(() => false),
}) {
  @modelAction
  initializeTree(partialNotes: PartialNote[]): void {
    const rootNode = this.rootNodeRef.current;

    partialNotes.forEach(({ title: noteTitle, id }) => {
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
    });

    rootNode.nodeRefs = rootNode.nodeRefs.filter(
      (nodeRef) => nodeRef.current.nodeRefs.length !== 0,
    );

    this.isInitialized = true;
  }

  handleNotesChanges(changes: INoteChangeEvent[]) {
    console.log({ changes });
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
