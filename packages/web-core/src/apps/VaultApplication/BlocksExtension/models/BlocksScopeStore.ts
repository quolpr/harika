import {
  arraySet,
  idProp,
  model,
  Model,
  modelAction,
  ModelCreationData,
  ModelData,
  prop,
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
  id: idProp,
  blocksScopes: prop<Record<string, BlocksScope>>(() => ({})),
}) {
  isScopePresent(
    scopedBy: { $modelId: string; $modelType: string },
    rootBlockId: string,
  ) {
    const key = getScopeKey(
      scopedBy.$modelId,
      scopedBy.$modelType,
      rootBlockId,
    );

    return !!this.blocksScopes[key];
  }

  @modelAction
  createScope(
    scopedBy: { $modelId: string; $modelType: string },
    rootBlockId: string,
  ) {
    const key = getScopeKey(
      scopedBy.$modelId,
      scopedBy.$modelType,
      rootBlockId,
    );

    const scope = new BlocksScope({
      id: key,
      rootBlockId,
      scopeId: scopedBy.$modelId,
      scopeType: scopedBy.$modelType,
      collapsedBlockIds: arraySet([]),
    });

    this.blocksScopes[key] = scope;

    return scope;
  }

  getScopeById(id: string) {
    return this.blocksScopes[id];
  }

  getScope(
    model: { $modelId: string; $modelType: string },
    rootBlockId: string,
  ) {
    const key = getScopeKey(model.$modelId, model.$modelType, rootBlockId);

    if (!this.blocksScopes[key]) return undefined;

    return this.blocksScopes[key];
  }

  @withoutUndoAction
  @withoutSyncAction
  @modelAction
  handleModelChanges(
    scopes: ModelData<BlocksScope>[],
    deletedScopeIds: SyncModelId<BlocksScope>[],
  ) {
    deletedScopeIds.forEach((id) => {
      delete this.blocksScopes[id.value];
    });

    scopes.forEach((scope) => {
      if (this.blocksScopes[scope.id!]) {
        applyModelData(this.blocksScopes[scope.id!], scope);
      } else {
        this.blocksScopes[scope.id!] = new BlocksScope(scope);
      }
    });
  }
}
