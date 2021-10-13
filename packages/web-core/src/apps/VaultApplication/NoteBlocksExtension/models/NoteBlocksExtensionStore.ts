import { Model, model, modelAction, prop } from 'mobx-keystone';
import type { ModelCreationData } from 'mobx-keystone';
import { BlockModelsRegistry } from './BlockModelsRegistry';
import { NoteBlockModel } from './NoteBlockModel';
import { BlockContentModel } from './BlockContentModel';
import { withoutSyncAction } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { BlocksTreeDescriptor } from './BlocksTreeDescriptor';
import { generateId } from '../../../../lib/generateId';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';
import { withoutUndoAction } from '../../../../lib/utils';

const blocksApp = '@harika/noteBlocks/NoteBlocksExtensionStore';

export const isBlocksApp = (obj: any): obj is NoteBlocksExtensionStore => {
  return obj.$modelType === blocksApp;
};

@model(blocksApp)
export class NoteBlocksExtensionStore extends Model({
  // key === noteId
  blocksRegistries: prop<Record<string, BlockModelsRegistry>>(() => ({})),
  blocksTreeDescriptors: prop<Record<string, BlocksTreeDescriptor>>(() => ({})),
}) {
  areBlocksOfNoteLoaded(noteId: string) {
    return !!this.blocksRegistries[noteId];
  }

  getNoteBlock(blockId: string) {
    for (const registry of Object.values(this.blocksRegistries)) {
      const block = registry.getBlockById(blockId);

      if (block) return block;
    }

    return undefined;
  }

  @withoutUndoAction
  @modelAction
  createNewBlocksTree(noteId: string, options?: { addEmptyBlock?: boolean }) {
    options = { addEmptyBlock: true, ...options };

    const rootBlockId = generateId();
    const rootBlock = new NoteBlockModel({
      $modelId: rootBlockId,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      noteId: noteId,
      noteBlockRefs: [],
      content: new BlockContentModel({ _value: '' }),
      linkedNoteIds: [],
    });

    const registry = new BlockModelsRegistry({
      noteId: noteId,
      rootBlockId: rootBlock.$modelId,
    });

    registry.registerNewBlock(rootBlock);

    this.blocksRegistries[noteId] = registry;
    this.blocksTreeDescriptors[noteId] = new BlocksTreeDescriptor({
      $modelId: noteId,
      rootBlockId,
    });

    if (options.addEmptyBlock) {
      registry.createBlock(
        { content: new BlockContentModel({ _value: '' }) },
        rootBlock,
        0,
      );
    }

    return { registry, rootBlock };
  }

  getBlocksRegistryByNoteId(noteId: string) {
    return this.blocksRegistries[noteId];
  }

  @withoutSyncAction
  @modelAction
  loadBlocksTree(
    descriptorAttrs: (ModelCreationData<BlocksTreeDescriptor> & {
      $modelId: string;
    })[],
    blocksAttrs: (ModelCreationData<NoteBlockModel> & {
      $modelId: string;
    })[],
    createBlocksRegistry: boolean,
  ) {
    descriptorAttrs.forEach((attr) => {
      this.blocksTreeDescriptors[attr.$modelId] = new BlocksTreeDescriptor(
        attr,
      );
    });

    blocksAttrs.map((attr) => {
      const existentNoteBlock = this.getNoteBlock(attr.$modelId);
      if (existentNoteBlock && existentNoteBlock.noteId !== attr.noteId) {
        existentNoteBlock.delete(false, false);

        delete this.blocksRegistries[existentNoteBlock.noteId].blocksMap[
          attr.$modelId
        ];
      }

      if (!this.blocksRegistries[attr.noteId] && createBlocksRegistry) {
        if (!this.blocksTreeDescriptors[attr.noteId]) {
          throw new Error(`Root block not found for noteId=${attr.noteId}`);
        }

        this.blocksRegistries[attr.noteId] = new BlockModelsRegistry({
          noteId: attr.noteId,
          rootBlockId: this.blocksTreeDescriptors[attr.noteId].rootBlockId,
        });
      }

      if (this.blocksRegistries[attr.noteId]) {
        return this.blocksRegistries[attr.noteId].createOrUpdateBlock(attr);
      }

      return undefined;
    });
  }

  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleModelChanges(
    descriptorAttrs: (ModelCreationData<BlocksTreeDescriptor> & {
      $modelId: string;
    })[],
    blocksAttrs: (ModelCreationData<NoteBlockModel> & {
      $modelId: string;
    })[],
    [deletedTreeDescriptorIds, deletedNoteBlockIds]: [
      SyncModelId<BlocksTreeDescriptor>[],
      SyncModelId<NoteBlockModel>[],
    ],
    createBlocksRegistry: boolean,
  ) {
    deletedTreeDescriptorIds.forEach((id) => {
      delete this.blocksTreeDescriptors[id.value];
    });
    deletedNoteBlockIds.forEach((id) => {
      this.getNoteBlock(id.value)?.delete();
    });

    this.loadBlocksTree(descriptorAttrs, blocksAttrs, createBlocksRegistry);
  }
}
