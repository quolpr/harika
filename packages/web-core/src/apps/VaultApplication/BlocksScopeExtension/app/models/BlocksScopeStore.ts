import {
  arraySet,
  detach,
  model,
  Model,
  modelAction,
  ModelCreationData,
  prop,
  rootRef,
} from 'mobx-keystone';
import {
  withoutSync,
  withoutSyncAction,
} from '../../../../../extensions/SyncExtension/app/mobx-keystone/syncable';
import { SyncModelId } from '../../../../../extensions/SyncExtension/types';
import { withoutUndoAction } from '../../../../../lib/utils';
import {
  BlockModelsRegistry,
  blocksRegistryRef,
} from '../../../NoteBlocksExtension/app/models/BlockModelsRegistry';
import { BlocksScope } from './BlocksScope';

export const getScopeKey = (
  noteId: string,
  scopedModelId: string,
  scopedModelType: string,
  rootBlockViewId: string,
) => {
  return `${noteId}-${scopedModelType}-${scopedModelId}-${rootBlockViewId}`;
};

@model('@harika/BlocksScopeStore')
export class BlocksScopeStore extends Model({
  blocksScopes: prop<Record<string, BlocksScope>>(() => ({})),
}) {
  @withoutUndoAction
  @modelAction
  deleteScopesOfBlocks(blockIds: string[]) {
    Object.values(this.blocksScopes).forEach((scope) => {
      if (blockIds.includes(scope.rootScopedBlockId)) {
        detach(scope);
      }
    });
  }

  @withoutUndoAction
  @modelAction
  getOrCreateScopes(
    args: {
      noteId: string;
      scopedBy: { $modelId: string; $modelType: string };
      collapsedBlockIds: string[];
      rootBlockViewId: string;
      blockModelsRegistry: BlockModelsRegistry;
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
          arg.blockModelsRegistry,
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
    blockModelsRegistry: BlockModelsRegistry,
  ) {
    const key = getScopeKey(
      noteId,
      scopedBy.$modelType,
      scopedBy.$modelId,
      rootBlockViewId,
    );

    const blocksScope = new BlocksScope({
      $modelId: key,
      rootScopedBlockId: rootBlockViewId,
      collapsedBlockIds: arraySet(collapsedBlockIds),
      scopedModelId: scopedBy.$modelId,
      scopedModelType: scopedBy.$modelType,
      blocksRegistryRef: blocksRegistryRef(blockModelsRegistry),
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

  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleModelChanges(
    scopes: (ModelCreationData<BlocksScope> & { $modelId: string })[],
    [deletedScopeIds]: [SyncModelId<BlocksScope>[]],
  ) {
    deletedScopeIds.forEach((id) => {
      delete this.blocksScopes[id.value];
    });

    scopes.forEach((scope) => {
      if (!scope.blocksRegistryRef.isValid) return;

      this.blocksScopes[scope.$modelId] = new BlocksScope(scope);
    });
  }
}
