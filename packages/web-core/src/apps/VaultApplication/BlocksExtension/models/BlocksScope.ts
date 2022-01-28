import { computed } from 'mobx';
import { ArraySet, model, Model, modelAction, prop } from 'mobx-keystone';
import { syncable } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { normalizeBlockTree } from '../../../../lib/blockParser/blockUtils';
import { withoutUndoAction } from '../../../../lib/utils';
import { CollapsableBlock } from './CollapsableBlock';

export const blocksScopeType = '@harika/BlocksExtension/BlocksScope';

// TODO: move selection to separate class
@syncable
@model(blocksScopeType)
export class BlocksScope extends Model({
  selectionInterval: prop<[string, string] | undefined>(),
  prevSelectionInterval: prop<[string, string] | undefined>(),
  // Is needed to handle when shift+click pressed
  addableSelectionId: prop<string | undefined>(),

  collapsedBlockIds: prop<ArraySet<string>>(),
  rootBlockId: prop<string>(),

  scopeId: prop<string>(),
  scopeType: prop<string>(),
}) {
  @computed
  get isSelecting() {
    return this.selectionInterval !== undefined;
  }

  getSelectedBlocks(rootScopedBlock: CollapsableBlock) {
    if (!this.selectionInterval) return [];

    const [fromId, toId] = this.selectionInterval;

    const flattenTree = rootScopedBlock.flattenTree;

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

    const ids = new Set<CollapsableBlock>();

    flattenTree.slice(sliceFrom, sliceTo + 1).forEach((block) => {
      ids.add(block);

      if (block.children.length !== 0) {
        block.flattenTree.forEach((child) => {
          ids.add(child);
        });
      }
    });

    return Array.from(ids);
  }

  getSelectedBlockIds(rootScopedBlock: CollapsableBlock) {
    return this.getSelectedBlocks(rootScopedBlock).map(
      ({ $modelId }) => $modelId,
    );
  }

  getStringTreeToCopy(rootScopedBlock: CollapsableBlock) {
    let str = '';

    this.getSelectedBlocks(rootScopedBlock).forEach((block) => {
      str += `${'  '.repeat(
        block.indent - 1,
      )}- ${block.originalBlock.toString()}\n`;
    });

    return normalizeBlockTree(str);
  }

  @withoutUndoAction
  @modelAction
  setSelectionInterval(fromId: string, toId: string) {
    this.selectionInterval = [fromId, toId];
    this.addableSelectionId = undefined;
  }

  @withoutUndoAction
  @modelAction
  resetSelection() {
    this.selectionInterval = undefined;
    this.addableSelectionId = undefined;
  }

  @withoutUndoAction
  @modelAction
  expandSelection(id: string) {
    this.addableSelectionId = id;
  }

  @withoutUndoAction
  @modelAction
  toggleExpand(blockId: string) {
    if (this.collapsedBlockIds.has(blockId)) {
      this.collapsedBlockIds.delete(blockId);
    } else {
      this.collapsedBlockIds.add(blockId);
    }
  }
}
