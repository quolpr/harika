import {
  arraySet,
  Model,
  model,
  modelAction,
  onChildAttachedTo,
  prop,
} from 'mobx-keystone';
import type { ModelCreationData } from 'mobx-keystone';
import { BlocksScope } from './views/BlocksScope';
import {
  BlockModelsRegistry,
  blocksRegistryRef,
} from './models/BlockModelsRegistry';
import { FocusedBlock } from './views/FocusedBlock';
import { NoteBlockModel } from './models/NoteBlockModel';
import { generateId } from '../../../generateId';
import { BlockContentModel } from './models/BlockContentModel';
import { ScopedBlocksRegistry } from './views/ScopedBlocksRegistry';

const blocksApp = '@harika/NoteBlocksApp';

export const isBlocksApp = (obj: any): obj is NoteBlocksApp => {
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
export class NoteBlocksApp extends Model({
  // key === noteId
  blocksRegistries: prop<Record<string, BlockModelsRegistry>>(() => ({})),
  blocksScopes: prop<Record<string, BlocksScope>>(() => ({})),
  focusedBlock: prop<FocusedBlock>(() => new FocusedBlock({})),
}) {
  areBlocksOfNoteLoaded(noteId: string) {
    return !!this.blocksRegistries[noteId];
  }

  getNoteBlock(blockId: string) {
    for (const registry of Object.values(this.blocksRegistries)) {
      const block = registry.blocksMap[blockId];

      if (block) return block;
    }

    return undefined;
  }

  @modelAction
  createNewBlocksTree(
    noteId: string,
    options?: { addEmptyBlock?: boolean; isDaily?: boolean },
  ) {
    options = { addEmptyBlock: true, ...options };
    const rootBlock = new NoteBlockModel({
      $modelId: generateId(),
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      noteId: noteId,
      noteBlockRefs: [],
      content: new BlockContentModel({ value: '' }),
      linkedNoteIds: [],
    });

    const registry = new BlockModelsRegistry({
      blocksMap: { [rootBlock.$modelId]: rootBlock },
      noteId: noteId,
      rootBlockId: rootBlock.$modelId,
    });

    this.blocksRegistries[noteId] = registry;

    if (options.addEmptyBlock) {
      registry.createBlock(
        { content: new BlockContentModel({ value: '' }) },
        rootBlock,
        0,
      );
    }

    return { registry, rootBlock };
  }
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
      rootScopedBlockId: rootBlockViewId,
      scopedBlocksRegistry: new ScopedBlocksRegistry({
        blocksRegistryRef: blocksRegistryRef(this.blocksRegistries[noteId]),
        collapsedBlockIds: arraySet(collapsedBlockIds),
        rootScopedBlockId: rootBlockViewId,
      }),
      scopedModelId: scopedBy.$modelId,
      scopedModelType: scopedBy.$modelType,
    });

    this.blocksScopes[key] = blocksScope;

    // TODO: load only partial from root, block views
    // TODO: dispose
    onChildAttachedTo(
      () => this.blocksRegistries[noteId].blocksMap,
      (ch) => {
        if (ch instanceof NoteBlockModel) {
          blocksScope.scopedBlocksRegistry.getOrCreateScopedBlock(ch);

          return () => {
            blocksScope.scopedBlocksRegistry.removeScopedBlock(ch.$modelId);
          };
        }
      },
    );

    return this.blocksScopes[key];
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

  createOrUpdateEntitiesFromAttrs(
    blocksAttrs: (ModelCreationData<NoteBlockModel> & {
      $modelId: string;
    })[],
    noteIdRootIdMap: Record<string, string>,
    createBlocksRegistry: boolean,
  ) {
    blocksAttrs.map((attr) => {
      const existentNoteBlock = this.getNoteBlock(attr.$modelId);
      if (existentNoteBlock && existentNoteBlock.noteId !== attr.noteId) {
        existentNoteBlock.delete();

        delete this.blocksRegistries[existentNoteBlock.noteId].blocksMap[
          attr.$modelId
        ];
      }

      if (!this.blocksRegistries[attr.noteId] && createBlocksRegistry) {
        if (!noteIdRootIdMap[attr.noteId]) {
          throw new Error(`Root block not found for noteId=${attr.noteId}`);
        }

        this.blocksRegistries[attr.noteId] = new BlockModelsRegistry({
          noteId: attr.noteId,
          rootBlockId: noteIdRootIdMap[attr.noteId],
        });
      }

      if (this.blocksRegistries[attr.noteId]) {
        return this.blocksRegistries[attr.noteId].createOrUpdateBlock(attr);
      }

      return undefined;
    });

    // blocks.forEach((model) => {
    //   if (!model) return;

    //   const toRemoveRefs = model.noteBlockRefs
    //     .map((ref) => {
    //       if (!this.blocksTreeHoldersMap[model.noteId].blocksMap[ref.id]) {
    //         return ref;
    //       }

    //       return false;
    //     })
    //     .filter(Boolean) as Ref<NoteBlockModel>[];

    //   toRemoveRefs.forEach((ref) => {
    //     console.error(
    //       'removing noteblock ref cause noteblock was not found',
    //       ref.id,
    //       JSON.stringify(model.$),
    //     );

    //     model.noteBlockRefs.splice(model.noteBlockRefs.indexOf(ref), 1);
    //   });
    // });
  }
}