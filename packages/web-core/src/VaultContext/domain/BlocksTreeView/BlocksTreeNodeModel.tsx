import { comparer, computed } from 'mobx';
import {
  findParent,
  model,
  Model,
  modelAction,
  prop,
  Ref,
} from 'mobx-keystone';
import {
  allRightSiblingsFunc,
  deepLastRightChildFunc,
  flattenTreeFunc,
  getStringTreeFunc,
  indentFunc,
  ITreeNode,
  leftAndRightFunc,
  leftAndRightSiblingFunc,
  mergeToLeftAndDeleteFunc,
  moveFunc,
  nearestRightToParentFunc,
  orderHashFunc,
  pathFunc,
  siblingsFunc,
} from '../../../mobx-tree';
import type { NoteBlockModel } from '../NoteBlockModel';

export const viewTreeHolderType = 'harika/BlockViewTreeHolder';

const isViewTreeHolder = (obj: any): obj is ViewTreeHolder => {
  return obj.$modelType === viewTreeHolderType;
};

@model('harika/BlocksTreeNodeModel')
export class BlocksViewNodeModel
  extends Model({
    noteBlockRef: prop<Ref<NoteBlockModel>>(),
    isExpanded: prop<boolean>(),
  })
  implements ITreeNode<BlocksViewNodeModel>
{
  @computed
  get isRoot() {
    return this.viewTreeHolder.rootBlockId === this.$modelId;
  }

  @computed
  get viewTreeHolder() {
    return findParent<ViewTreeHolder>(this, isViewTreeHolder)!;
  }

  @computed
  get parent() {
    if (this.viewTreeHolder.rootBlockId === this.$modelId) return undefined;

    const parentBlock = this.noteBlockRef.current.parent;

    return parentBlock && this.viewTreeHolder.nodesMap[parentBlock.$modelId];
  }

  @computed({ equals: comparer.shallow })
  get children(): BlocksViewNodeModel[] {
    if (this.isExpanded) {
      return this.noteBlockRef.current.noteBlockRefs.map(({ id }) => {
        return this.viewTreeHolder.nodesMap[id];
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
  get path(): BlocksViewNodeModel[] {
    return pathFunc(this);
  }

  @computed
  get orderPosition() {
    return this.parent ? this.parent.orderHash[this.$modelId] : 0;
  }

  @computed({ equals: comparer.shallow })
  get siblings(): BlocksViewNodeModel[] {
    return siblingsFunc(this);
  }

  @modelAction
  spliceChild(
    start: number,
    deleteCount?: number,
    ...nodes: BlocksViewNodeModel[]
  ) {}

  @modelAction
  move(parent: BlocksViewNodeModel, pos: number | 'start' | 'end') {
    moveFunc(this, parent, pos);
  }

  @computed
  get textContent() {
    return this.noteBlockRef.current.content.value;
  }

  @computed({ equals: comparer.shallow })
  get flattenTree(): BlocksViewNodeModel[] {
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
    left: BlocksViewNodeModel | undefined,
    right: BlocksViewNodeModel | undefined,
  ] {
    return leftAndRightSiblingFunc(this);
  }

  @computed
  get deepLastRightChild(): BlocksViewNodeModel {
    return deepLastRightChildFunc(this);
  }

  @computed
  get nearestRightToParent(): BlocksViewNodeModel | undefined {
    return nearestRightToParentFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get leftAndRight(): [
    left: BlocksViewNodeModel | undefined,
    right: BlocksViewNodeModel | undefined,
  ] {
    return leftAndRightFunc(this);
  }

  @computed({ equals: comparer.shallow })
  get allRightSiblings(): BlocksViewNodeModel[] {
    return allRightSiblingsFunc(this);
  }

  getStringTree(
    includeId: boolean = false,
    indent = this.isRoot ? -1 : 0,
  ): string {
    return getStringTreeFunc(this, includeId, indent);
  }

  @modelAction
  mergeToLeftAndDelete(): BlocksViewNodeModel | undefined {
    return mergeToLeftAndDeleteFunc(this);
  }

  @modelAction
  handleMerge(from: BlocksViewNodeModel, to: BlocksViewNodeModel) {
    this.noteBlockRef.current.handleMerge(
      from.noteBlockRef.current,
      to.noteBlockRef.current,
    );
  }
}

@model(viewTreeHolderType)
export class ViewTreeHolder extends Model({
  nodesMap: prop<Record<string, BlocksViewNodeModel>>(() => ({})),
  rootBlockId: prop<string>(),
}) {}
