export interface ICreateChange<
  TableName extends string = string,
  Obj extends Record<string, any> & { id: string } = Record<string, any> & {
    id: string;
  },
> {
  id: string;
  type: DatabaseChangeType.Create;
  table: TableName;
  key: string;
  obj: Obj;
}

export interface IUpdateChange<
  TableName extends string = string,
  Obj extends Record<string, any> & { id: string } = Record<string, any> & {
    id: string;
  },
> {
  id: string;
  type: DatabaseChangeType.Update;
  table: TableName;
  key: string;
  obj?: Obj; // new object
  from: Partial<Obj>;
  to: Partial<Obj>;
}

export interface IDeleteChange<
  TableName extends string = string,
  Obj extends Record<string, any> & { id: string } = Record<string, any> & {
    id: string;
  },
> {
  id: string;
  type: DatabaseChangeType.Delete;
  table: TableName;
  key: string;
  obj: Obj;
}

export type IDatabaseChange<
  TableName extends string = string,
  Obj extends Record<string, any> & { id: string } = Record<string, any> & {
    id: string;
  },
> =
  | ICreateChange<TableName, Obj>
  | IUpdateChange<TableName, Obj>
  | IDeleteChange<TableName, Obj>;
export enum DatabaseChangeType {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export enum CommandTypesFromClient {
  ApplyNewChanges = 'apply_new_changes',
  GetChanges = 'get_changes',
}

export type ApplyNewChangesFromClientCommand = {
  type: CommandTypesFromClient.ApplyNewChanges;

  request: ApplyNewChangesFromClientRequest;
  response: ApplyNewChangesFromClientResponse;
};

export interface ApplyNewChangesFromClientRequest {
  changes: IDatabaseChange[];
  partial: boolean;
  lastAppliedRemoteRevision: number | null;
}

export type ApplyNewChangesFromClientResponse =
  | {
      status: 'success';
      newRev: number;
    }
  | {
      status: 'stale_changes' | 'locked';
    };

export type GetChangesClientCommand = {
  type: CommandTypesFromClient.GetChanges;

  request: GetChangesRequest;
  response: GetChangesResponse;
};

export interface GetChangesRequest {
  fromRevision: null | number;
  includeSelf: false;
}

export interface GetChangesResponse {
  changes: (IDatabaseChange & { rev: number })[];
  currentRevision: number;
}

export type ClientCommands =
  | GetChangesClientCommand
  | ApplyNewChangesFromClientCommand;

export type ClientCommandRequests =
  | GetChangesRequest
  | ApplyNewChangesFromClientRequest;

export type ClientCommandResponses =
  | GetChangesResponse
  | ApplyNewChangesFromClientResponse;

// Server:

export enum EventTypesFromServer {
  RevisionWasChanged = 'revisionWasChanged',
}
