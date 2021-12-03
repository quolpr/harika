interface IScopedChange {
  scopeId?: string;
}

export type IAnyEntity = Record<string, any> & {
  id: string;
};

export interface ICreateChange<
  TableName extends string = string,
  Obj extends IAnyEntity = IAnyEntity
> extends IScopedChange {
  id: string;
  type: DatabaseChangeType.Create;
  table: TableName;
  key: string;
  obj: Obj;
}

export interface IUpdateChange<
  TableName extends string = string,
  Obj extends IAnyEntity = IAnyEntity
> extends IScopedChange {
  id: string;
  type: DatabaseChangeType.Update;
  table: TableName;
  key: string;
  from: Partial<Obj>;
  to: Partial<Obj>;
}

export interface IDeleteChange<TableName extends string = string>
  extends IScopedChange {
  id: string;
  type: DatabaseChangeType.Delete;
  table: TableName;
  key: string;
}

export type IDatabaseChange<
  TableName extends string = string,
  Obj extends IAnyEntity = IAnyEntity
> =
  | ICreateChange<TableName, Obj>
  | IUpdateChange<TableName, Obj>
  | IDeleteChange<TableName>;

export enum DatabaseChangeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}
