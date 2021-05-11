// TODO: move to lib and use in nestjs
export const enum DatabaseChangeType {
  Create = 1,
  Update = 2,
  Delete = 3,
}

export interface ICreateChange<
  TableName extends string,
  Obj extends Record<string, unknown>
> {
  type: DatabaseChangeType.Create;
  table: TableName;
  key: string;
  obj: Obj;
  source: string;
}

export interface IUpdateChange<
  TableName extends string,
  Obj extends Record<string, unknown>
> {
  type: DatabaseChangeType.Update;
  table: TableName;
  key: string;
  mods: { [keyPath: string]: unknown | undefined };
  obj: Obj;
  oldObj: Obj;
  source: string;
}

export interface IDeleteChange<
  TableName extends string,
  Obj extends Record<string, unknown>
> {
  type: DatabaseChangeType.Delete;
  table: TableName;
  key: string;
  oldObj: Obj;
  source: string;
}

export type IDatabaseChange<
  TableName extends string,
  Obj extends Record<string, unknown>
> =
  | ICreateChange<TableName, Obj>
  | IUpdateChange<TableName, Obj>
  | IDeleteChange<TableName, Obj>;
