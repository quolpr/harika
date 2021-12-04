export type IAnyEntity = Record<string, any> & {
  id: string;
};

// TODO rename tableName -> collectionName
// key -> documentId

interface IBaseChange<TableName extends string = string> {
  id: string;
  key: string;
  table: TableName;
  scopeId?: string;
  timestamp: string;
}

export interface ICreateChange<
  TableName extends string = string,
  Obj extends IAnyEntity = IAnyEntity
> extends IBaseChange<TableName> {
  type: DatabaseChangeType.Create;
  obj: Obj;
}

export interface IUpdateChange<
  TableName extends string = string,
  Obj extends IAnyEntity = IAnyEntity
> extends IBaseChange<TableName> {
  type: DatabaseChangeType.Update;
  from: Partial<Obj>;
  to: Partial<Obj>;
}

export interface IDeleteChange<TableName extends string = string>
  extends IBaseChange<TableName> {
  type: DatabaseChangeType.Delete;
}

export type IDatabaseChange<
  TableName extends string = string,
  Obj extends IAnyEntity = IAnyEntity
> =
  | ICreateChange<TableName, Obj>
  | IUpdateChange<TableName, Obj>
  | IDeleteChange<TableName>;

export type IDatabaseChangeWithRev<
  TableName extends string = string,
  Obj extends IAnyEntity = IAnyEntity
> = IDatabaseChange<TableName, Obj> & {
  rev: number;
};

export enum DatabaseChangeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}
