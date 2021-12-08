export type IAnyDoc = Record<string, any> & {
  id: string;
};

interface IBaseChange<CollectionName extends string = string> {
  id: string;
  docId: string;
  collectionName: CollectionName;
  scopeId?: string;
  timestamp: string;
}

export interface ICreateChange<
  CollectionName extends string = string,
  Doc extends IAnyDoc = IAnyDoc
> extends IBaseChange<CollectionName> {
  type: DocChangeType.Create;
  doc: Doc;
}

export interface IUpdateChange<
  CollectionName extends string = string,
  Doc extends IAnyDoc = IAnyDoc
> extends IBaseChange<CollectionName> {
  type: DocChangeType.Update;
  from: Partial<Doc>;
  to: Partial<Doc>;
}

export interface IDeleteChange<CollectionName extends string = string>
  extends IBaseChange<CollectionName> {
  type: DocChangeType.Delete;
}

export type IDocChange<
  CollectionName extends string = string,
  Doc extends IAnyDoc = IAnyDoc
> =
  | ICreateChange<CollectionName, Doc>
  | IUpdateChange<CollectionName, Doc>
  | IDeleteChange<CollectionName>;

export type WithRev<T> = T & { rev: number };

export type IDocChangeWithRev<
  CollectionName extends string = string,
  Doc extends IAnyDoc = IAnyDoc
> = WithRev<IDocChange<CollectionName, Doc>>;

export type IDocSnapshot<
  CollectionName extends string = string,
  Doc extends IAnyDoc = IAnyDoc
> = {
  collectionName: CollectionName;
  doc: Doc;
  docId: string;
  lastTimestamp: string;
  scopeId?: string;
  isDeleted: boolean;
};

export enum DocChangeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}
