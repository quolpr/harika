import { comparer, computed } from 'mobx';
import {
  findParent,
  model,
  Model,
  modelAction,
  prop,
  Ref,
} from 'mobx-keystone';
import { normalizeBlockTree } from '../../../blockParser/blockUtils';
import {
  allRightSiblingsFunc,
  deepLastRightChildFunc,
  flattenTreeFunc,
  indentFunc,
  ITreeNode,
  leftAndRightFunc,
  leftAndRightSiblingFunc,
  nearestRightToParentFunc,
  orderHashFunc,
  pathFunc,
  siblingsFunc,
} from '../../../mobx-tree';
import type { NoteBlockModel } from '../NoteBlockModel';

export const viewRegistryType = '@harika/NoteBlockViewRegistry';

const isViewRegistry = (obj: any): obj is ViewRegistry => {
  return obj.$modelType === viewRegistryType;
};

type IMove = {
  id: string;
  newParentId: string;
  orderPosition: number | 'start' | 'end';
};

type IMerge = {
  fromId: string;
  toId: string;
};

@model('harika/BlocksTreeNodeModel')
export class BlocksViewModel
  extends Model({
    noteBlockRef: prop<Ref<NoteBlockModel>>(),
    isExpanded: prop<boolean>(),
  })
  implements ITreeNode<BlocksViewModel>
{
  @computed
  get textContent() {
    return this.content.value;
  }

  @computed
  get content() {
    return this.noteBlockRef.current.content;
  }

  @computed
  get isRoot() {
    return this.treeRegistry.rootViewRef.$modelId === this.$modelId;
  }

  @computed
  get treeRegistry() {
    return findParent<ViewRegistry>(this, isViewRegistry)!;
  }

  @computed
  get parent() {
    if (this.treeRegistry.rootViewRef.$modelId === this.$modelId)
      return undefined;

    const parentBlock = this.noteBlockRef.current.parent;

    return parentBlock && this.treeRegistry.blockViewMap[parentBlock.$modelId];
  }

  @computed({ equals: comparer.shallow })
  get children(): BlocksViewModel[] {
    if (this.isExpanded) {
      return this.noteBlockRef.current.noteBlockRefs.map(({ id }) => {
        return this.treeRegistry.viewsMap[id];
      });
    } else {
      return [];
    }
  }

  @computed({ equals: comparer.shallow })
  get orderHash(): Record<string, number> {
    return orderHashFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get path(): BlocksViewModel[] {
    return pathFunc(this);
  }

  @computed
  get orderPosition() {
    return this.parent ? this.parent.orderHash[this.$modelId] : 0;
  }

  @computed({ equals: comparer.shallow })
  get siblings(): BlocksViewModel[] {
    return siblingsFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get flattenTree(): BlocksViewModel[] {
    return flattenTreeFunc(this);
  }

  @computed
  get indent(): number {
    return indentFunc(this);
  }

  @computed
  get hasChildren() {
    return this.children.length !== 0;
  }

  @computed({ equals: comparer.shallow })
  get leftAndRightSibling(): [
    left: BlocksViewModel | undefined,
    right: BlocksViewModel | undefined,
  ] {
    return leftAndRightSiblingFunc(this);
  }

  @computed
  get deepLastRightChild(): BlocksViewModel {
    return deepLastRightChildFunc(this);
  }

  @computed
  get nearestRightToParent(): BlocksViewModel | undefined {
    return nearestRightToParentFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRight(): [
    left: BlocksViewModel | undefined,
    right: BlocksViewModel | undefined,
  ] {
    return leftAndRightFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get allRightSiblings(): BlocksViewModel[] {
    return allRightSiblingsFunc(this);
  }

  @computed
  getStringTree(includeId: boolean, indent: number): string {
    let str = this.isRoot
      ? ''
      : `${'  '.repeat(indent)}- ${this.textContent}${
          includeId ? ` [#${this.noteBlockRef.id}]` : ''
        }\n`;

    this.children.forEach((node) => {
      str += node.getStringTree(includeId, node.isRoot ? 0 : indent + 1);
    });

    return str;
  }

  moveLeftCmd(): IMove | undefined {
    if (!this.parent) {
      throw new Error("Can't move root block");
    }

    const [left] = this.leftAndRight;

    if (!left) return;

    if (!left.parent) {
      throw new Error("Left couldn't be root block");
    }

    if (left === this.parent) {
      // If left block is parent

      return {
        id: this.noteBlockRef.id,
        newParentId: left.parent.noteBlockRef.id,
        orderPosition: left.orderPosition,
      };
    } else if (left.parent !== this.parent) {
      // If left is child of child of child...

      return {
        id: this.noteBlockRef.id,
        newParentId: left.parent.noteBlockRef.id,
        orderPosition: left.orderPosition + 1,
      };
    } else {
      // if same level

      return {
        id: this.noteBlockRef.id,
        newParentId: left.parent.noteBlockRef.id,
        orderPosition: left.orderPosition,
      };
    }
  }

  moveRightCmd(): IMove | undefined {
    let [, right] = this.leftAndRightSibling;

    if (!right) {
      right = this.nearestRightToParent;
    }

    if (!right) return;

    if (!right.parent) {
      throw new Error("Right couldn't be root block");
    }

    if (right.children.length) {
      return {
        id: this.noteBlockRef.id,
        newParentId: right.parent.noteBlockRef.id,
        orderPosition: 'start',
      };
    } else {
      return {
        id: this.noteBlockRef.id,
        newParentId: right.parent.noteBlockRef.id,
        orderPosition: right.orderPosition,
      };
    }
  }

  moveUpCmd(): IMove | undefined {
    const [left] = this.leftAndRightSibling;

    if (left) {
      return {
        id: this.noteBlockRef.id,
        newParentId: left.noteBlockRef.id,
        orderPosition: 'end',
      };
    }
  }

  moveDownCmd(): IMove | undefined {
    const parentRef = this.parent;
    const parentOfParent = parentRef?.parent;

    if (!parentRef || !parentOfParent) return;

    return {
      id: this.noteBlockRef.id,
      newParentId: parentOfParent.noteBlockRef.id,
      orderPosition: parentRef.orderPosition + 1,
    };
  }

  mergeLeftAndDeleteCmd(): IMerge | undefined {
    const [left] = this.leftAndRight;

    if (!left) return;

    return {
      fromId: this.noteBlockRef.id,
      toId: left.noteBlockRef.id,
    };
  }
}

@model(viewRegistryType)
class ViewRegistry extends Model({
  viewsMap: prop<Record<string, BlocksViewModel>>(() => ({})),
  rootViewRef: prop<Ref<BlocksViewModel>>(),
}) {
  @computed({ equals: comparer.shallow })
  get blockViewMap() {
    return Object.fromEntries(
      Object.values(this.viewsMap).map((view) => [view.noteBlockRef.id, view]),
    );
  }

  @computed({ equals: comparer.shallow })
  get collapsedBlockIds() {
    return Object.values(this.viewsMap)
      .filter((view) => !view.isExpanded)
      .map((view) => view.noteBlockRef.id);
  }
}

@model('@harika/BlocksUIState')
export class BlocksUIState extends Model({
  viewRegistry: prop<ViewRegistry>(),

  selectionInterval: prop<[string, string] | undefined>(),
  prevSelectionInterval: prop<[string, string] | undefined>(),
  // Is needed to handle when shift+click pressed
  addableSelectionId: prop<string | undefined>(),
  scopedModelId: prop<string>(),
  scopedModelType: prop<string>(),
}) {
  getStringTreeToCopy() {
    let str = '';

    this.selectedIds.forEach((id) => {
      const block = this.viewRegistry.viewsMap[id];

      str += `${'  '.repeat(block.indent - 1)}- ${block.textContent}\n`;
    });

    return normalizeBlockTree(str);
  }

  @computed
  get isSelecting() {
    return this.selectionInterval !== undefined;
  }

  @computed({ equals: comparer.shallow })
  get selectedIds() {
    if (!this.selectionInterval) return [];

    const [fromId, toId] = this.selectionInterval;

    const flattenTree = this.viewRegistry.rootViewRef.current.flattenTree;

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
