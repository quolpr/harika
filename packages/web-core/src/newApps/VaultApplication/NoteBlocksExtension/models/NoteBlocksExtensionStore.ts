import { arraySet, Model, model, modelAction, prop } from 'mobx-keystone';
import type { ModelCreationData } from 'mobx-keystone';
import { BlocksScope } from './BlocksScope';
import { BlockModelsRegistry } from './BlockModelsRegistry';
import { NoteBlockModel } from './NoteBlockModel';
import { BlockContentModel } from './BlockContentModel';
import { withoutUndoAction } from '../../../../lib/utils';
import { withoutSyncAction } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { BlocksTreeDescriptor } from './BlocksTreeDescriptor';
import { generateId } from '../../../../lib/generateId';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';

const blocksApp = '@harika/noteBlocks/NoteBlocksExtensionStore';

export const isBlocksApp = (obj: any): obj is NoteBlocksExtensionStore => {
  return obj.$modelType === blocksApp;
};

export const getScopeKey = (
  noteId: string,
  scopedModelId: string,
  scopedModelType: string,
  rootBlockViewId: string,
) => {
  return `${noteId}-${scopedModelType}-${scopedModelId}-${rootBlockViewId}`;
};

@model(blocksApp)
export class NoteBlocksExtensionStore extends Model({
  // key === noteId
  blocksRegistries: prop<Record<string, BlockModelsRegistry>>(() => ({})),
  blocksScopes: prop<Record<string, BlocksScope>>(() => ({})),

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

  @withoutUndoAction
  @modelAction
  getOrCreateScopes(
    args: {
      noteId: string;
      scopedBy: { $modelId: string; $modelType: string };
      collapsedBlockIds: string[];
      rootBlockViewId: string;
    }[],
  ) {
    return args.map((arg) => {
      const key = getScopeKey(
        arg.noteId,
        arg.scopedBy.$modelType,
        arg.scopedBy.$modelId,
        arg.rootBlockViewId,
      );

      return (
        this.blocksScopes[key] ||
        this.createScope(
          arg.noteId,
          arg.scopedBy,
          arg.collapsedBlockIds,
          arg.rootBlockViewId,
        )
      );
    });
  }

  isScopeCreated(
    noteId: string,
    scopedBy: { $modelId: string; $modelType: string },
    rootBlockViewId: string,
  ) {
    const key = getScopeKey(
      noteId,
      scopedBy.$modelType,
      scopedBy.$modelId,
      rootBlockViewId,
    );

    return !!this.blocksScopes[key];
  }

  private createScope(
    noteId: string,
    scopedBy: { $modelId: string; $modelType: string },
    collapsedBlockIds: string[],
    rootBlockViewId: string,
  ) {
    const key = getScopeKey(
      noteId,
      scopedBy.$modelType,
      scopedBy.$modelId,
      rootBlockViewId,
    );

    if (!this.areBlocksOfNoteLoaded(noteId)) {
      throw new Error('You need to load blocks first');
    }

    const blocksScope = new BlocksScope({
      $modelId: key,
      rootScopedBlockId: rootBlockViewId,
      collapsedBlockIds: arraySet(collapsedBlockIds),
      scopedModelId: scopedBy.$modelId,
      scopedModelType: scopedBy.$modelType,
      noteId,
    });

    this.blocksScopes[key] = blocksScope;

    return this.blocksScopes[key];
  }

  getScopeById(id: string) {
    return this.blocksScopes[id];
  }

  getScope(
    noteId: string,
    model: { $modelId: string; $modelType: string },
    rootViewId: string,
  ) {
    const key = `${noteId}-${model.$modelType}-${model.$modelId}-${rootViewId}`;

    if (!this.blocksScopes[key]) return undefined;

    return this.blocksScopes[key];
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

  @withoutSyncAction
  @modelAction
  handleModelChanges(
    descriptorAttrs: (ModelCreationData<BlocksTreeDescriptor> & {
      $modelId: string;
    })[],
    blocksAttrs: (ModelCreationData<NoteBlockModel> & {
      $modelId: string;
    })[],
    scopes: (ModelCreationData<BlocksScope> & { $modelId: string })[],
    [deletedTreeDescriptorIds, deletedNoteBlockIds, deletedScopeIds]: [
      SyncModelId<BlocksTreeDescriptor>[],
      SyncModelId<NoteBlockModel>[],
      SyncModelId<BlocksScope>[],
    ],
    createBlocksRegistry: boolean,
  ) {
    deletedScopeIds.forEach((id) => {
      delete this.blocksScopes[id.value];
    });
    deletedTreeDescriptorIds.forEach((id) => {
      delete this.blocksTreeDescriptors[id.value];
    });
    deletedNoteBlockIds.forEach((id) => {
      this.getNoteBlock(id.value)?.delete();
    });

    scopes.forEach((scope) => {
      this.blocksScopes[scope.$modelId] = new BlocksScope(scope);
    });

    this.loadBlocksTree(descriptorAttrs, blocksAttrs, createBlocksRegistry);
  }
}
