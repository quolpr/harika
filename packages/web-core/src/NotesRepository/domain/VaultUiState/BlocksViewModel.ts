import { comparer, computed } from 'mobx';
import { model, Model, modelAction, prop, Ref } from 'mobx-keystone';
import { normalizeBlockTree } from '../../../blockParser/blockUtils';
import type { BlocksTreeHolder } from '../NoteBlockModel';

@model('harika/BlocksViewModel')
export class BlocksViewModel extends Model({
  collapsedBlockIds: prop<string[]>(() => []),
  blockTreeHolderRef: prop<Ref<BlocksTreeHolder>>(),
  selectionInterval: prop<[string, string] | undefined>(),
  prevSelectionInterval: prop<[string, string] | undefined>(),
  // Is needed to handle when shift+click pressed
  addableSelectionId: prop<string | undefined>(),
  scopedModelId: prop<string>(),
  scopedModelType: prop<string>(),
}) {
  isExpanded(noteBlockId: string) {
    return (
      this.collapsedBlockIds.find((id) => noteBlockId === id) === undefined
    );
  }

  getStringTreeToCopy() {
    let str = '';

    this.selectedIds.forEach((id) => {
      const block = this.blockTreeHolderRef.current.blocksMap[id];

      str += `${'  '.repeat(block.indent - 1)}- ${block.content.value}\n`;
    });

    return normalizeBlockTree(str);
  }

  @modelAction
  toggleExpand(noteBlockId: string) {
    if (this.isExpanded(noteBlockId)) {
      this.collapsedBlockIds = [...this.collapsedBlockIds, noteBlockId];
    } else {
      this.collapsedBlockIds = this.collapsedBlockIds.filter(
        (id) => id !== noteBlockId,
      );
    }
  }

  @computed
  get isSelecting() {
    return this.selectionInterval !== undefined;
  }

  @computed({ equals: comparer.shallow })
  get selectedIds() {
    if (!this.selectionInterval) return [];

    const [fromId, toId] = this.selectionInterval;

    const flattenTree = this.blockTreeHolderRef.current.rootBlock.flattenTree;

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

    const ids = new Set<string>();

    flattenTree.slice(sliceFrom, sliceTo + 1).forEach((block) => {
      ids.add(block.$modelId);

      if (block.hasChildren) {
        block.flattenTree.forEach((child) => {
          ids.add(child.$modelId);
        });
      }
    });

    return Array.from(ids);
  }

  @modelAction
  setSelectionInterval(fromId: string, toId: string) {
    this.selectionInterval = [fromId, toId];
    this.addableSelectionId = undefined;
  }

  @modelAction
  resetSelection() {
    this.selectionInterval = undefined;
    this.addableSelectionId = undefined;
  }

  @modelAction
  expandSelection(id: string) {
    this.addableSelectionId = id;
  }
}
