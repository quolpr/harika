import { AnyModel, ModelCreationData } from 'mobx-keystone';
type Class<T = any> = new (...args: any[]) => T;
export type IMapper<Doc = any, Model extends AnyModel = any> = {
  mapToModelData: (arg: Doc) => ModelCreationData<Model> & { $modelId: string };
  mapToDoc: (arg: Model) => Doc;

  tableName: string;
  model: Class<Model>;
};
