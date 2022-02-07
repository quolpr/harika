import { action, comparer, computed, makeObservable, observable } from 'mobx';
import { normalizeBlockTree } from '../../../../lib/blockParser/blockUtils';
import { BlocksScope } from './BlocksScope';
import { CollapsableBlock } from './CollapsableBlock';

const selections: WeakMap<
  BlocksScope,
  WeakMap<CollapsableBlock, BlocksSelection>
> = new WeakMap();

export const getBlocksSelection = (
  scope: BlocksScope,
  rootBlock: CollapsableBlock,
) => {
  if (!selections.get(scope)) {
    selections.set(scope, new WeakMap<CollapsableBlock, BlocksSelection>());
  }

  if (!selections.get(scope)!.get(rootBlock)) {
    selections.get(scope)!.set(rootBlock, new BlocksSelection(rootBlock));
  }

  return selections.get(scope)!.get(rootBlock)!;
};

export class BlocksSelection {
  @observable selectionInterval: [string, string] | undefined;
  @observable addableSelectionId: string | undefined;

  constructor(private rootBlock: CollapsableBlock) {
    makeObservable(this);
  }

  @action
  setSelectionInterval(fromId: string, toId: string) {
    this.selectionInterval = [fromId, toId];
    this.addableSelectionId = undefined;
  }

  @action
  resetSelection() {
    this.selectionInterval = undefined;
    this.addableSelectionId = undefined;
  }

  @action
  expandSelection(id: string) {
    this.addableSelectionId = id;
  }

  @computed({ equals: comparer.shallow })
  get selectedBlockIds() {
    return this.selectedBlocks.map(({ $modelId }) => $modelId);
  }

  @computed
  get stringTreeToCopy() {
    let str = '';

    this.selectedBlocks.forEach((block) => {
      str += `${'  '.repeat(
        block.indent - 1,
      )}- ${block.originalBlock.toString()}\n`;
    });

    return normalizeBlockTree(str);
  }

  @computed
  get isSelecting() {
    return this.selectionInterval !== undefined;
  }

  @computed({ equals: comparer.shallow })
  get selectedBlocks() {
    if (!this.selectionInterval) return [];

    const [fromId, toId] = this.selectionInterval;

    const flattenTree = this.rootBlock.flattenTree;

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
}
