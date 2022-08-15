export type IAnyDoc = Record<string, string | number | null | undefined> & {
  id: string;
};

export interface IBaseChange<CollectionName extends string = string> {
  id: string;
  docId: string;
  collectionName: CollectionName;
  scopeId?: string | null | undefined;
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
export type WithClientId<T> = T & { receivedFromClientId: string };

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
  scopeId?: string | null | undefined;
  isDeleted: boolean;
  rev: number;
};

export enum DocChangeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}
