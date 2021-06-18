export enum DatabaseChangeType {
  Create = 1,
  Update = 2,
  Delete = 3,
}

export enum MessageType {
  Event = 'event',
  Command = 'command',
}

// Client
export enum CommandTypesFromClient {
  ApplyNewChanges = 'applyNewChanges',
  InitializeClient = 'initializeClient',
  SubscribeClientToChanges = 'subscribeClientToChanges',
  // Locking is needed to perform notes merginf with the same title - the conflicts resolution
  // If lock happened - nobody will be able to send changes except the one who made the lock
  StartLock = 'startLock',
  FinishLock = 'finishLock',
  GetChanges = 'getChanges',
}

export interface BaseMessage {
  id: string;
  messageType: MessageType;
}

export interface ApplyNewChangesFromClient extends BaseMessage {
  messageType: MessageType.Command;

  type: CommandTypesFromClient.ApplyNewChanges;
  changes: IDatabaseChange[];
  partial: boolean;
  baseRevision: number | null;
}

export interface SubscribeClientToChanges extends BaseMessage {
  messageType: MessageType.Command;

  type: CommandTypesFromClient.SubscribeClientToChanges;
  syncedRevision: number | null;
}

export interface InitializeClient extends BaseMessage {
  messageType: MessageType.Command;

  type: CommandTypesFromClient.InitializeClient;
  identity: string;
  scopeId: string;
}

export interface StartClientLock extends BaseMessage {
  messageType: MessageType.Command;

  type: CommandTypesFromClient.StartLock;
}

export interface FinishClientLock extends BaseMessage {
  messageType: MessageType.Command;

  type: CommandTypesFromClient.FinishLock;
}

export interface GetChanges extends BaseMessage {
  messageType: MessageType.Command;
  type: CommandTypesFromClient.GetChanges;
  lastReceivedRemoteRevision: null | number;
}

export type CommandsFromClient =
  | ApplyNewChangesFromClient
  | SubscribeClientToChanges
  | InitializeClient
  | StartClientLock
  | FinishClientLock
  | GetChanges;

export type MessagesFromClient = CommandsFromClient;

// Server

export enum EventTypesFromServer {
  CommandHandled = 'commandHandled',
  MasterWasSet = 'masterWasSet',
  RevisionWasChanged = 'revisionWasChanged',
  NewChangesReceived = 'newChangesReceived',
}

export interface CommandFromClientHandled extends BaseMessage {
  messageType: MessageType.Event;
  type: EventTypesFromServer.CommandHandled;

  status: 'ok' | 'error';

  handledId: string;

  // TODO: refactor typing system
  data?: {
    type: 'newChanges';
    changes: IDatabaseChange[];
    currentRevision: number;
  };
}

export interface MasterClientWasSet extends BaseMessage {
  messageType: MessageType.Event;
  type: EventTypesFromServer.MasterWasSet;

  identity: string;
}

export interface RevisionWasChanged extends BaseMessage {
  messageType: MessageType.Event;
  type: EventTypesFromServer.RevisionWasChanged;

  newRevision: number;
}

export interface NewChangesReceived extends BaseMessage {
  messageType: MessageType.Event;
  type: EventTypesFromServer.NewChangesReceived;
}

export type EventsFromServer =
  | CommandFromClientHandled
  | MasterClientWasSet
  | RevisionWasChanged;

export enum CommandTypesFromServer {
  ApplyNewChanges = 'applyNewChanges',
}

export interface ApplyNewChangesFromServer extends BaseMessage {
  messageType: MessageType.Command;

  type: CommandTypesFromServer.ApplyNewChanges;
  changes: IDatabaseChange[];
  partial: boolean;
  currentRevision: number;
}

export type CommandsFromServer = ApplyNewChangesFromServer;

export type MessagesFromServer = CommandsFromServer | EventsFromServer;

// Database types

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

// DatabaseChange

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
