import { computed } from 'mobx';
import { model, Model, modelAction, prop, Ref } from 'mobx-keystone';
import type { NoteModel } from '../NoteModel';

@model('harika/BlocksViewModel')
export class BlocksViewModel extends Model({
  expandedIds: prop<Record<string, boolean>>(() => ({})),
  noteRef: prop<Ref<NoteModel>>(),
  selectionInterval: prop<[string, string] | undefined>(),
  // Is needed to handle when shift+click pressed
  addableSelectionId: prop<string | undefined>(),
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

  @computed
  get selectedIds() {
    if (!this.selectionInterval) return [];

    const [fromId, toId] = this.selectionInterval;

    const flattenTree = this.noteRef.current.rootBlockRef.current.flattenTree;

    const fromIndex = flattenTree.findIndex(
      ({ $modelId }) => $modelId === fromId,
    );
    const toIndex = flattenTree.findIndex(({ $modelId }) => $modelId === toId);

    let sliceFrom = Math.min(fromIndex, toIndex);
    let sliceTo = Math.max(fromIndex, toIndex);

    if (this.addableSelectionId) {
      const addableIndex = flattenTree.findIndex(
        ({ $modelId }) => $modelId === this.addableSelectionId,
      );

      if (sliceFrom <= addableIndex && addableIndex <= sliceTo) {
        if (fromIndex > toIndex) {
          sliceFrom = addableIndex;
        } else {
          sliceTo = addableIndex;
        }
      } else {
        sliceFrom = Math.min(addableIndex, sliceFrom);
        sliceTo = Math.max(addableIndex, sliceTo);
      }
    }

    return flattenTree
      .slice(sliceFrom, sliceTo + 1)
      .map(({ $modelId }) => $modelId);
  }

  @modelAction
  setSelectionInterval(fromId: string, toId: string) {
    this.selectionInterval = [fromId, toId];
  }

  @modelAction
  resetSelection() {
    this.selectionInterval = undefined;
    this.addableSelectionId = undefined;
  }

  @modelAction
  fixSelection() {
    const selected = this.selectedIds;

    if (selected.length > 0) {
      this.selectionInterval = [selected[0], selected[selected.length - 1]];
    }
  }

  @modelAction
  expandSelection(id: string) {
    this.addableSelectionId = id;
  }
}
