import { IDocChange, IDocSnapshot } from './dbTypes';

export enum CommandTypesFromClient {
  ApplyNewChanges = 'applyNewChanges',
  GetSnapshots = 'getSnapshots',
  Auth = 'auth',
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

export type AuthClientCommand = {
  type: CommandTypesFromClient.Auth;

  request: AuthClientRequest;
  response: AuthClientResponse;
};

export interface AuthClientRequest {
  authToken: string;
  dbName: string;
  clientId: string;
}

export type AuthClientResponse = {
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
  currentRevision: number;
  lastTimestamp: string;
  status: 'success';
}

export type ClientCommands =
  | GetSnapshotsClientCommand
  | ApplyNewChangesFromClientCommand
  | AuthClientCommand;

export type ClientCommandRequests =
  | GetSnapshotsRequest
  | ApplyNewChangesFromClientRequest;

export type ClientCommandResponses =
  | GetSnapshotsResponse
  | ApplyNewChangesFromClientResponse;
