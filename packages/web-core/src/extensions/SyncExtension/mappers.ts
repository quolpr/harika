import { AnyModel, ModelCreationData } from 'mobx-keystone';

export const SYNC_MAPPER = 'SYNC_MAPPER';

type Class<T = any> = new (...args: any[]) => T;
export type IMapper<Doc, Model extends AnyModel> = {
  mapToModelData: (arg: Doc) => ModelCreationData<Model> & { $modelId: string };
  mapToDoc: (arg: Model) => Doc;

  tableName: string;
  model: Class<Model>;
};
