import { AnyModel, ModelData } from 'mobx-keystone';
type Class<T = any> = new (...args: any[]) => T;
export type IMapper<Doc = any, Model extends AnyModel = any> = {
  mapToModelData: (
    arg: Doc,
  ) => ModelData<Model> & { id: string; $modelType: string };
  mapToDoc: (arg: Model) => Doc;

  collectionName: string;
  model: Class<Model>;
};
