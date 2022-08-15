import { AnyModel, ModelData } from 'mobx-keystone';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Class<T> = new (...args: any[]) => T;
export type IMapper<
  Doc extends Record<string, string | number | null | undefined> = Record<
    string,
    string | number | null | undefined
  >,
  Model extends AnyModel = AnyModel,
> = {
  mapToModelData: (
    arg: Doc,
  ) => ModelData<Model> & { id: string; $modelType: string };
  mapToDoc: (arg: Model) => Doc;

  collectionName: string;
  model: Class<Model>;
};
