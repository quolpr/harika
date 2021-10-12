import { comparer, computed } from 'mobx';
import {
  ArraySet,
  model,
  Model,
  modelAction,
  ModelCreationData,
  onChildAttachedTo,
  prop,
} from 'mobx-keystone';
import { Optional } from 'utility-types';
import { syncable } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import {
  addTokensToNoteBlock,
  normalizeBlockTree,
} from '../../../../lib/blockParser/blockUtils';
import { TreeToken } from '../../../../lib/blockParser/parseStringToTree';
import { withoutUndoAction } from '../../../../lib/utils';
import { BlockModelsRegistry } from '../../NoteBlocksExtension/models/BlockModelsRegistry';
import { NoteBlockModel } from '../../NoteBlocksExtension/models/NoteBlockModel';
import { ScopedBlock } from './ScopedBlock';
import { ScopedBlocksRegistry } from './ScopedBlocksRegistry';

export const blocksScopeType = '@harika/BlocksScope';

// TODO: rename scopedModelType to scopeType scopeId
// cause modelType could be not mobx model type
// TODO: move selection to separate class
@syncable
@model(blocksScopeType)
export class BlocksScope extends Model({
  selectionInterval: prop<[string, string] | undefined>(),
  prevSelectionInterval: prop<[string, string] | undefined>(),
  // Is needed to handle when shift+click pressed
  addableSelectionId: prop<string | undefined>(),

  collapsedBlockIds: prop<ArraySet<string>>(),
  rootScopedBlockId: prop<string>(),

  scopedModelId: prop<string>(),
  scopedModelType: prop<string>(),
}) {
  public deleteScopesOfBlocks!: (ids: string[]) => void;
  public blockModelsRegistry!: BlockModelsRegistry;
  private scopedBlocksRegistry = new ScopedBlocksRegistry();

  getStringTreeToCopy() {
    let str = '';

    this.selectedIds.forEach((id) => {
      const block = this.scopedBlocksRegistry.getScopedBlock(id);

      str += `${'  '.repeat(block.indent - 1)}- ${block.textContent}\n`;
    });

    return normalizeBlockTree(str);
  }

  @computed({ equals: comparer.shallow })
  get blocksWithoutParent() {
    return this.scopedBlocksRegistry.allBlocks.filter((block) => {
      return (
        !this.blockModelsRegistry.childParentRelations[block.$modelId] &&
        block.$modelId !== this.rootScopedBlockId
      );
    });
  }

  @computed
  get noteId() {
    return this.blockModelsRegistry.noteId;
  }

  @computed
  get rootScopedBlock(): ScopedBlock | undefined {
    return this.scopedBlocksRegistry.getScopedBlock(this.rootScopedBlockId);
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

  @modelAction
  getOrCreateScopedBlock = (blockId: string) => {
    if (this.scopedBlocksRegistry.getScopedBlock(blockId)) {
      return this.scopedBlocksRegistry.getScopedBlock(blockId);
    } else {
      const newBlock: ScopedBlock = new ScopedBlock(
        this.blockModelsRegistry.getBlockById(blockId),
        computed(() => {
          return this.collapsedBlockIds;
        }),
        computed(() => this.rootScopedBlock),
        this.scopedBlocksRegistry.getScopedBlock,
        this.createBlock,
      );
      this.scopedBlocksRegistry.addScopedBlock(newBlock);

      return newBlock;
    }
  };

  @modelAction
  moveToRoot(block: ScopedBlock) {
    if (!this.rootScopedBlock) return;

    block.move(this.rootScopedBlock, 'end');
  }

  @modelAction
  createBlock = (
    attrs: Optional<
      ModelCreationData<NoteBlockModel>,
      'createdAt' | 'noteId' | 'noteBlockRefs' | 'linkedNoteIds' | 'updatedAt'
    >,
    parent: ScopedBlock,
    pos: number | 'append',
  ) => {
    const block = this.blockModelsRegistry.createBlock(
      attrs,
      parent.noteBlock,
      pos,
    );

    return this.getOrCreateScopedBlock(block.$modelId);
  };

  @modelAction
  deleteNoteBlockIds(ids: string[]) {
    this.blockModelsRegistry.deleteNoteBlockIds(ids);

    this.deleteScopesOfBlocks(ids);
  }

  @modelAction
  injectNewTreeTokens(block: ScopedBlock, tokens: TreeToken[]): ScopedBlock[] {
    return addTokensToNoteBlock(block, tokens, (...args) =>
      this.createBlock(...args),
    );
  }

  onInit() {
    onChildAttachedTo(
      () => this.blockModelsRegistry.blocksMap,
      (ch) => {
        if (ch instanceof NoteBlockModel) {
          this.getOrCreateScopedBlock(ch.$modelId);

          return () => {
            this.scopedBlocksRegistry.removeScopedBlock(ch.$modelId);
          };
        }
      },
    );
  }
}