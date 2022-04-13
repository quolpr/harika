import { AnyModel, ModelCreationData } from 'mobx-keystone';
import { Class } from 'utility-types';

import { Transaction } from '../DbExtension/DB';

// Just for better typing
export type SyncModelId<T extends AnyModel = AnyModel> = {
  value: string;
  model: Class<T>;
};

export type CreationDataWithId<T extends AnyModel = AnyModel> =
  ModelCreationData<T> & {
    $modelId: string;
  };

export const SYNC_CONNECTION_ALLOWED = 'syncConnectionAllowed';
export const REPOS_WITH_SYNC = 'reposWithSync';
export const ROOT_STORE = 'rootStore';
export const SYNC_CONFIG = 'syncConfig';
export const SYNC_CONFLICT_RESOLVER = 'syncConflictResolver';
export const MODELS_CHANGES_PIPE = 'modelsChangePipe';

export interface ISyncConflictResolver {
  resolve(t: Transaction): Promise<void>;

  collectionNamesToResolve: string[] | 'any';
}

export interface ISyncConfig {
  apiUrl: string;
  base: string;
  path: string;
}
