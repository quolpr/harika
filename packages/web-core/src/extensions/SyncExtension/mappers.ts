import { AnyModel, SnapshotInOf } from 'mobx-keystone';
type Class<T = any> = new (...args: any[]) => T;
export type IMapper<Doc = any, Model extends AnyModel = any> = {
  mapToModelData: (arg: Doc) => SnapshotInOf<Model> & { $modelId: string };
  mapToDoc: (arg: Model) => Doc;

  collectionName: string;
  model: Class<Model>;
};
