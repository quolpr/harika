import { AnyModel, ModelCreationData } from 'mobx-keystone';
import { Class } from 'utility-types';

// Just for better typing
export type SyncModelId<T extends AnyModel = AnyModel> = {
  value: string;
  model: Class<T>;
};

export type CreationDataWithId<T extends AnyModel = AnyModel> =
  ModelCreationData<T> & {
    $modelId: string;
  };

export const SYNC_AUTH_TOKEN = 'syncAuthToken';
export const SYNC_URL = 'syncUrl';
export const SYNC_CONNECTION_ALLOWED = 'syncConnectionAllowed';
export const REPOS_WITH_SYNC = 'reposWithSync';
export const ROOT_STORE = 'rootStore';
