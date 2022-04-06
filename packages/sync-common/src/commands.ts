import { IDocChange, IDocSnapshot } from './dbTypes';

export enum CommandTypesFromClient {
  ApplyNewChanges = 'applyNewChanges',
  GetSnapshots = 'getSnapshots',
  InitClient = 'initClient',
}

export enum EventsFromServer {
  RevisionChanged = 'revisionChanged',
}

export type InternalErrorResponse = {
  status: 'error';
  errorType: 'internalError';
};
export type NotAuthedResponse = { status: 'error'; errorType: 'notAuted' };

export type ErrorResponse = InternalErrorResponse | NotAuthedResponse;

export type InitClientCommand = {
  type: CommandTypesFromClient.InitClient;

  request: InitClientRequest;
  response: InitClientResponse;
};

export interface InitClientRequest {
  dbName: string;
  clientId: string;
}

export type InitClientResponse = {
  status: 'success' | 'failed';
};

export type ApplyNewChangesFromClientCommand = {
  type: CommandTypesFromClient.ApplyNewChanges;

  request: ApplyNewChangesFromClientRequest;
  response: ApplyNewChangesFromClientResponse | ErrorResponse;
};

export interface ApplyNewChangesFromClientRequest {
  changes: IDocChange[];
}

export type ApplyNewChangesFromClientResponse = {
  status: 'success';
  snapshots: IDocSnapshot[];
};

export type GetSnapshotsClientCommand = {
  type: CommandTypesFromClient.GetSnapshots;

  request: GetSnapshotsRequest;
  response: GetSnapshotsResponse | ErrorResponse;
};

export interface GetSnapshotsRequest {
  fromRev: number;
}

export interface GetSnapshotsResponse {
  snapshots: IDocSnapshot[];
  currentRevision: number | undefined;
  lastTimestamp: string | undefined;
  status: 'success';
}

export type ClientCommands =
  | GetSnapshotsClientCommand
  | ApplyNewChangesFromClientCommand
  | InitClientCommand;

export type ClientCommandRequests =
  | GetSnapshotsRequest
  | ApplyNewChangesFromClientRequest;

export type ClientCommandResponses =
  | GetSnapshotsResponse
  | ApplyNewChangesFromClientResponse;
