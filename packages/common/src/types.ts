export enum MessageType {
  Event = 'event',
  CommandRequest = 'commandRequest',
  CommandResponse = 'commandResponse',
}

export interface BaseMessage {
  messageId: string;
  messageType: MessageType;
}

export interface BaseCommandRequest extends BaseMessage {
  messageType: MessageType.CommandRequest;
}

export interface BaseCommandResponse extends BaseMessage {
  messageType: MessageType.CommandResponse;
  requestedMessageId: string;
}

export interface BaseEvent {
  messageType: MessageType.Event;
}

//// Client:

export enum CommandTypesFromClient {
  ApplyNewChanges = 'applyNewChanges',
  InitializeClient = 'initializeClient',
  GetChanges = 'getChanges',
}

export type ApplyNewChangesFromClientCommand = {
  request: ApplyNewChangesFromClientRequest;
  response: ApplyNewChangesFromClientResponse;
};

export interface ApplyNewChangesFromClientRequest extends BaseCommandRequest {
  type: CommandTypesFromClient.ApplyNewChanges;

  data: {
    changes: IDatabaseChange[];
    partial: boolean;
    baseRevision: number | null;
  };
}

export interface ApplyNewChangesFromClientResponse extends BaseCommandResponse {
  type: CommandTypesFromClient.ApplyNewChanges;

  data: {
    status: 'success' | 'staleChanges' | 'error';
  };
}

export type InitializeClientCommand = {
  request: InitializeClientRequest;
  response: InitializeClientResponse;
};

export interface InitializeClientRequest extends BaseCommandRequest {
  type: CommandTypesFromClient.InitializeClient;

  data: {
    identity: string;
    scopeId: string;
  };
}

export interface InitializeClientResponse extends BaseCommandResponse {
  type: CommandTypesFromClient.InitializeClient;

  data: {
    status: 'success' | 'error';
  };
}

export type GetChangesClientCommand = {
  request: GetChangesRequest;
  response: GetChangesResponse;
};

export interface GetChangesRequest extends BaseCommandRequest {
  type: CommandTypesFromClient.GetChanges;

  data: {
    lastReceivedRemoteRevision: null | number;
  };
}

export interface GetChangesResponse extends BaseCommandResponse {
  type: CommandTypesFromClient.GetChanges;

  data:
    | {
        status: 'error';
      }
    | {
        status: 'success';

        changes: IDatabaseChange[];
        currentRevision: number;
      };
}

export type ClientCommands =
  | GetChangesClientCommand
  | InitializeClientCommand
  | ApplyNewChangesFromClientCommand;

export type ClientCommandRequests =
  | GetChangesRequest
  | InitializeClientRequest
  | ApplyNewChangesFromClientRequest;

export type ClientCommandResponses =
  | GetChangesResponse
  | InitializeClientResponse
  | ApplyNewChangesFromClientResponse;

// Server:

export enum EventTypesFromServer {
  RevisionWasChanged = 'revisionWasChanged',
}

export interface RevisionWasChangedEvent extends BaseEvent {
  eventType: EventTypesFromServer.RevisionWasChanged;

  data: {
    newRevision: number;
  };
}

// DatabaseChange

export enum DatabaseChangeType {
  Create = 1,
  Update = 2,
  Delete = 3,
}
export type NoteDocType = {
  id: string;
  title: string;
  dailyNoteDate: number | undefined;
  rootBlockId: string;
  createdAt: number;
  updatedAt?: number;
};

export type NoteBlockDocType = {
  id: string;
  parentBlockId?: string;
  noteId: string;
  noteBlockIds: string[];
  linkedNoteIds: string[];
  content: string;
  createdAt: number;
  updatedAt?: number;
};

export interface ICreateChange<
  TableName extends string = string,
  Obj extends Record<string, unknown> = Record<string, unknown>,
> {
  type: DatabaseChangeType.Create;
  table: TableName;
  key: string;
  obj: Obj;
  source: string;
}

export interface IUpdateChange<
  TableName extends string = string,
  Obj extends Record<string, unknown> = Record<string, unknown>,
> {
  type: DatabaseChangeType.Update;
  table: TableName;
  key: string;
  mods: { [keyPath: string]: any };
  obj?: Obj | null | undefined;
  // undefined on backend
  oldObj?: Obj | null | undefined;
  source: string;
}

export interface IDeleteChange<
  TableName extends string = string,
  Obj extends Record<string, unknown> = Record<string, unknown>,
> {
  type: DatabaseChangeType.Delete;
  table: TableName;
  key: string;
  // undefined on backend
  oldObj?: Obj | null | undefined;
  source: string;
}

export type IDatabaseChange<
  TableName extends string = string,
  Obj extends Record<string, unknown> = Record<string, unknown>,
> =
  | ICreateChange<TableName, Obj>
  | IUpdateChange<TableName, Obj>
  | IDeleteChange<TableName, Obj>;

export type INoteChangeEvent = IDatabaseChange<'notes', NoteDocType>;
export type INoteBlockChangeEvent = IDatabaseChange<
  'noteBlocks',
  NoteBlockDocType
>;
export type IChangeEvent = INoteChangeEvent | INoteBlockChangeEvent;
