import {
  arraySet,
  Model,
  model,
  modelAction,
  onChildAttachedTo,
  prop,
  transaction,
} from 'mobx-keystone';
import type { ModelCreationData } from 'mobx-keystone';
import { BlocksScope } from './BlocksScope/BlocksScope';
import { BlocksRegistry, blocksRegistryRef } from './BlocksRegistry';
import { FocusedBlock } from './FocusedBlock';
import { NoteBlockModel } from './NoteBlockModel';
import { generateId } from '../../../generateId';
import { BlockContentModel } from './NoteBlockModel/BlockContentModel';
import { ViewRegistry } from './BlocksScope/ViewRegistry';

const blocksApp = '@harika/NoteBlocksApp';

export const isBlocksApp = (obj: any): obj is NoteBlocksApp => {
  return obj.$modelType === blocksApp;
};

@model(blocksApp)
export class NoteBlocksApp extends Model({
  // key === noteId
  blocksRegistries: prop<Record<string, BlocksRegistry>>(() => ({})),
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
  createNewRegistry(
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

    const registry = new BlocksRegistry({
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
  createScope(
    noteId: string,
    model: { $modelId: string; $modelType: string },
    collapsedBlockIds: string[],
    rootViewId: string,
  ) {
    const key = `${noteId}-${model.$modelType}-${model.$modelId}-${rootViewId}`;

    if (!this.areBlocksOfNoteLoaded(noteId)) {
      throw new Error('You need to load blocks first');
    }

    const blocksScope = new BlocksScope({
      rootViewId: rootViewId,
      viewRegistry: new ViewRegistry({
        blocksRegistryRef: blocksRegistryRef(this.blocksRegistries[noteId]),
        collapsedBlockIds: arraySet(collapsedBlockIds),
        rootViewId: rootViewId,
      }),
      scopedModelId: model.$modelId,
      scopedModelType: model.$modelType,
    });

    this.blocksScopes[key] = blocksScope;

    // TODO: load only partial from root, block views
    onChildAttachedTo(
      () => this.blocksRegistries[noteId].blocksMap,
      (ch) => {
        if (ch instanceof NoteBlockModel) {
          blocksScope.viewRegistry.createView(ch);

          return () => {
            blocksScope.viewRegistry.removeView(ch);
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

  getBlocksRegistry(noteId: string) {
    return this.blocksRegistries[noteId];
  }

  @modelAction
  @transaction
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

      // TODO: fix
      if (!this.blocksRegistries[attr.noteId] && createBlocksRegistry) {
        if (!noteIdRootIdMap[attr.noteId]) {
          throw new Error(`Root block not found for noteId=${attr.noteId}`);
        }

        this.blocksRegistries[attr.noteId] = new BlocksRegistry({
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
