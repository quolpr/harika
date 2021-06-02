import { model, Model, modelAction, prop, Ref } from 'mobx-keystone';
import type { NoteModel } from './NoteModel';

@model('harika/BlocksViewModel')
export class BlocksViewModel extends Model({
  expandedIds: prop<Record<string, boolean>>(() => ({})),
  noteRef: prop<Ref<NoteModel>>(),
  selectedIds: prop<string[]>(() => []),
}) {
  isExpanded(noteBlockId: string) {
    if (this.expandedIds[noteBlockId] !== undefined)
      return this.expandedIds[noteBlockId];

    return true;
  }

  @modelAction
  toggleExpand(noteBlockId: string) {
    if (this.expandedIds[noteBlockId] !== undefined) {
      this.expandedIds[noteBlockId] = !this.expandedIds[noteBlockId];
    } else {
      this.expandedIds[noteBlockId] = false;
    }
  }

  @modelAction
  selectInterval(fromId: string, toId: string) {
    const flattenTree = this.noteRef.current.rootBlockRef.current.flattenTree;

    const fromIndex = flattenTree.findIndex(
      ({ $modelId }) => $modelId === fromId,
    );
    const toIndex = flattenTree.findIndex(({ $modelId }) => $modelId === toId);

    this.selectedIds = flattenTree
      .slice(Math.min(fromIndex, toIndex), Math.max(toIndex, fromIndex) + 1)
      .map(({ $modelId }) => $modelId);
  }

  @modelAction
  resetSelection() {}
}
