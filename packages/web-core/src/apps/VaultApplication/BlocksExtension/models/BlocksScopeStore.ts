import {
  applySnapshot,
  arraySet,
  detach,
  fromSnapshot,
  model,
  Model,
  modelAction,
  ModelData,
  prop,
  SnapshotInOf,
} from 'mobx-keystone';
import { withoutSyncAction } from '../../../../extensions/SyncExtension/mobx-keystone/syncable';
import { SyncModelId } from '../../../../extensions/SyncExtension/types';
import { withoutUndoAction } from '../../../../lib/utils';
import { applyModelData } from './applyModelData';
import { BlocksScope } from './BlocksScope';

export const getScopeKey = (
  scopeId: string,
  scopeType: string,
  rootBlock: string,
) => {
  return `${scopeType}-${scopeId}-${rootBlock}`;
};

@model('@harika/BlocksExtension/BlocksScopeStore')
export class BlocksScopeStore extends Model({
  blocksScopes: prop<Record<string, BlocksScope>>(() => ({})),
}) {
  @withoutUndoAction
  @modelAction
  deleteScopesOfBlocks(blockIds: string[]) {
    Object.values(this.blocksScopes).forEach((scope) => {
      if (blockIds.includes(scope.rootBlockId)) {
        detach(scope);
      }
    });
  }

  @withoutUndoAction
  @modelAction
  getOrCreateScopes(
    args: {
      scopedBy: { $modelId: string; $modelType: string };
      collapsedBlockIds: string[];
      rootBlockId: string;
    }[],
  ) {
    return args.map((arg) => {
      const key = getScopeKey(
        arg.scopedBy.$modelId,
        arg.scopedBy.$modelType,
        arg.rootBlockId,
      );

      return (
        this.blocksScopes[key] ||
        this.createScope(arg.scopedBy, arg.rootBlockId, arg.collapsedBlockIds)
      );
    });
  }

  isScopeCreated(
    noteId: string,
    scopedBy: { $modelId: string; $modelType: string },
    rootBlockViewId: string,
  ) {
    const key = getScopeKey(
      scopedBy.$modelId,
      scopedBy.$modelType,
      rootBlockViewId,
    );

    return !!this.blocksScopes[key];
  }

  getScopeById(id: string) {
    return this.blocksScopes[id];
  }

  getScope(
    model: { $modelId: string; $modelType: string },
    rootViewId: string,
  ) {
    const key = getScopeKey(model.$modelId, model.$modelType, rootViewId);

    if (!this.blocksScopes[key]) return undefined;

    return this.blocksScopes[key];
  }

  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleModelChanges(
    scopes: (ModelData<BlocksScope> & { $modelType: string })[],
    deletedScopeIds: SyncModelId<BlocksScope>[],
  ) {
    deletedScopeIds.forEach((id) => {
      delete this.blocksScopes[id.value];
    });

    scopes.forEach((scope) => {
      if (this.blocksScopes[scope.$modelId!]) {
        applyModelData(this.blocksScopes[scope.$modelId!], scope);
      } else {
        this.blocksScopes[scope.$modelId!] = new BlocksScope(scope);
      }
    });
  }

  private createScope(
    scopedBy: { $modelId: string; $modelType: string },
    rootBlockViewId: string,
    collapsedBlockIds: string[],
  ) {
    const key = getScopeKey(
      scopedBy.$modelId,
      scopedBy.$modelType,
      rootBlockViewId,
    );

    const blocksScope = new BlocksScope({
      $modelId: key,
      rootBlockId: rootBlockViewId,
      collapsedBlockIds: arraySet(collapsedBlockIds),
      scopeId: scopedBy.$modelId,
      scopeType: scopedBy.$modelType,
    });

    this.blocksScopes[key] = blocksScope;

    return this.blocksScopes[key];
  }
}
