import { comparer, computed } from 'mobx';
import { ArraySet, model, Model, modelAction, prop, Ref } from 'mobx-keystone';
import { syncable } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { normalizeBlockTree } from '../../../../lib/blockParser/blockUtils';
import { withoutUndoAction } from '../../../../lib/utils';
import { BlockModelsRegistry } from '../../NoteBlocksExtension/models/BlockModelsRegistry';
import { ScopedBlock } from './ScopedBlock';
import { ScopedBlocksRegistry } from './ScopedBlocksRegistry';

export const blocksScopeType = '@harika/BlocksScope';

// TODO: rename scopedModelType to scopeType scopeId
// cause modelType could be not mobx model type
// TODO: move selection to separate class
@syncable
@model(blocksScopeType)
export class BlocksScope extends Model({
  blocksRegistryRef: prop<Ref<BlockModelsRegistry>>(),
  selectionInterval: prop<[string, string] | undefined>(),
  prevSelectionInterval: prop<[string, string] | undefined>(),
  // Is needed to handle when shift+click pressed
  addableSelectionId: prop<string | undefined>(),

  collapsedBlockIds: prop<ArraySet<string>>(),
  rootScopedBlockId: prop<string>(),

  scopedModelId: prop<string>(),
  scopedModelType: prop<string>(),

  noteId: prop<string>(),
}) {
  private scopedBlocksRegistry = new ScopedBlocksRegistry();

  @computed({ equals: comparer.shallow })
  get blocksWithoutParent() {
    return this.scopedBlocksRegistry.allBlocks.filter((block) => {
      return (
        !this.blocksRegistryRef.current.childParentRelations[block.$modelId] &&
        block.$modelId !== this.rootScopedBlockId
      );
    });
  }

  @computed
  get rootScopedBlock(): ScopedBlock | undefined {
    return this.scopedBlocksRegistry.getScopedBlock(this.rootScopedBlockId);
  }

  @computed
  get isSelecting() {
    return this.selectionInterval !== undefined;
  }

  @computed({ equals: comparer.shallow })
  get selectedIds() {
    if (!this.selectionInterval) return [];

    const [fromId, toId] = this.selectionInterval;

    const flattenTree = this.rootScopedBlock?.flattenTree;

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

  getStringTreeToCopy() {
    let str = '';

    this.selectedIds.forEach((id) => {
      const block = this.scopedBlocksRegistry.getScopedBlock(id);

      str += `${'  '.repeat(block.indent - 1)}- ${block.textContent}\n`;
    });

    return normalizeBlockTree(str);
  }

  getView(id: string) {
    return this.scopedBlocksRegistry.getScopedBlock(id);
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
