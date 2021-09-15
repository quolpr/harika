import { comparer, computed } from 'mobx';
import { model, Model, modelAction, prop } from 'mobx-keystone';
import { normalizeBlockTree } from '../../../../blockParser/blockUtils';
import type { ScopedBlocksRegistry } from './ScopedBlocksRegistry';

@model('@harika/BlocksScope')
export class BlocksScope extends Model({
  scopedBlocksRegistry: prop<ScopedBlocksRegistry>(),

  selectionInterval: prop<[string, string] | undefined>(),
  prevSelectionInterval: prop<[string, string] | undefined>(),
  // Is needed to handle when shift+click pressed
  addableSelectionId: prop<string | undefined>(),

  rootScopedBlockId: prop<string>(),
  scopedModelId: prop<string>(),
  scopedModelType: prop<string>(),
}) {
  getStringTreeToCopy() {
    let str = '';

    this.selectedIds.forEach((id) => {
      const block = this.scopedBlocksRegistry.getScopedBlock(id);

      str += `${'  '.repeat(block.indent - 1)}- ${block.textContent}\n`;
    });

    return normalizeBlockTree(str);
  }

  @computed
  get noteId() {
    return this.scopedBlocksRegistry.noteId;
  }

  @computed
  get rootScopedBlock() {
    return this.scopedBlocksRegistry.rootScopedBlock;
  }

  getView(id: string) {
    return this.scopedBlocksRegistry.getScopedBlock(id);
  }

  @computed
  get isSelecting() {
    return this.selectionInterval !== undefined;
  }

  @computed({ equals: comparer.shallow })
  get selectedIds() {
    if (!this.selectionInterval) return [];

    const [fromId, toId] = this.selectionInterval;

    const flattenTree = this.scopedBlocksRegistry.rootScopedBlock.flattenTree;

    if (!flattenTree) return [];

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