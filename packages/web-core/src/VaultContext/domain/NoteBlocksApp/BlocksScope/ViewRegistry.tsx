import { ArraySet, Model, model, modelAction, prop } from 'mobx-keystone';
import type { ModelCreationData, Ref } from 'mobx-keystone';
import { BlocksViewModel } from './BlocksViewModel';
import { computed } from 'mobx';
import { NoteBlockModel, noteBlockRef } from '../NoteBlockModel';
import type { Optional } from 'utility-types';
import type { BlocksRegistry } from '../BlocksRegistry';

export const viewRegistryType = '@harika/NoteBlockViewRegistry';
export const isViewRegistry = (obj: any): obj is ViewRegistry => {
  return obj.$modelType === viewRegistryType;
};

type BlockId = string;
type ViewId = string;

@model(viewRegistryType)
export class ViewRegistry extends Model({
  viewsMap: prop<Record<ViewId, BlocksViewModel>>(() => ({})),
  blockViewIdsMap: prop<Record<BlockId, ViewId>>(() => ({})),
  rootViewBlockId: prop<BlockId>(),
  blocksRegistryRef: prop<Ref<BlocksRegistry>>(),

  collapsedBlockIds: prop<ArraySet<BlockId>>(),
}) {
  createView(blockId: BlockId) {
    const newView = new BlocksViewModel({
      noteBlockRef: noteBlockRef(blockId),
    });

    this.viewsMap[newView.$modelId] = newView;
    this.blockViewIdsMap[blockId] = newView.$modelId;

    return newView;
  }

  removeBlock(blockId: BlockId) {
    const viewId = this.blockViewIdsMap[blockId];

    delete this.viewsMap[viewId];
    delete this.blockViewIdsMap[blockId];
  }

  getView(id: ViewId) {
    return this.viewsMap[id];
  }

  @computed
  get rootView() {
    return this.viewsMap[this.blockViewIdsMap[this.rootViewBlockId]];
  }

  @modelAction
  createBlock(
    attrs: Optional<
      ModelCreationData<NoteBlockModel>,
      'createdAt' | 'noteId' | 'noteBlockRefs' | 'linkedNoteIds' | 'updatedAt'
    >,
    parent: BlocksViewModel,
    pos: number,
  ) {
    const block = this.blocksRegistryRef.current.createBlock(
      attrs,
      parent.noteBlockRef.current,
      pos,
    );

    return this.createView(block.$modelId);
  }

  @modelAction
  addBlocks(blocks: NoteBlockModel[]) {
    this.blocksRegistryRef.current.addBlocks(blocks);
  }

  @modelAction
  deleteNoteBlockIds(ids: string[]) {}
}
