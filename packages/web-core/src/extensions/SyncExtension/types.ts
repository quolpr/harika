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
