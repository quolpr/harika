import { DatabaseChangeType } from 'dexie-observable/api';

export enum MessageType {
  Event = 'event',
  Command = 'command',
}

// Client
export enum CommandTypesFromClient {
  ApplyNewChanges = 'applyNewChanges',
  InitializeClient = 'initializeClient',
  SubscribeClientToChanges = 'subscribeClientToChanges',
}

export interface BaseMessage {
  id: string;
  messageType: MessageType;
}

interface ApplyNewChangesFromClient extends BaseMessage {
  messageType: MessageType.Command;

  type: CommandTypesFromClient.ApplyNewChanges;
  changes: IDatabaseChange[];
  partial: boolean;
  baseRevision: number;
}

interface SubscribeClientToChanges extends BaseMessage {
  messageType: MessageType.Command;

  type: CommandTypesFromClient.SubscribeClientToChanges;
  syncedRevision: number;
}

interface InitializeClient extends BaseMessage {
  messageType: MessageType.Command;

  type: CommandTypesFromClient.InitializeClient;
  identity: string;
  scopeId: string;
}

export type CommandsFromClient =
  | ApplyNewChangesFromClient
  | SubscribeClientToChanges
  | InitializeClient;

export type MessagesFromClient = CommandsFromClient;

// Server

export enum EventTypesFromServer {
  CommandHandled = 'commandHandled',
}

export interface CommandFromClientHandled extends BaseMessage {
  messageType: MessageType.Event;

  handledId: string;
}

export type EventsFromServer = CommandFromClientHandled;

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
  dailyNoteDate: number;
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
  TableName extends string = string,
  Obj extends Record<string, unknown> = Record<string, unknown>
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
