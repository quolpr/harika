import { User } from '../users/schemas/user.schema';

export enum DatabaseChangeType {
  Create = 1,
  Update = 2,
  Delete = 3,
}

export interface ICreateChange {
  type: DatabaseChangeType.Create;
  table: string;
  key: string;
  obj: any;
}

export interface IUpdateChange {
  type: DatabaseChangeType.Update;
  table: string;
  key: string;
  mods: { [keyPath: string]: any | undefined };
}

export interface IDeleteChange {
  type: DatabaseChangeType.Delete;
  table: string;
  key: string;
}

export type IDatabaseChange = ICreateChange | IUpdateChange | IDeleteChange;

export interface SyncEntitiesService {
  getChangesFromRev(
    scopeId: string,
    ownerId: string,
    rev: number,
    clientIdentity: string
  ): Promise<{ changes: IDatabaseChange[]; lastRev: number }>;

  applyChanges(
    changes: IDatabaseChange[],
    scopeId: string,
    ownerId: string,
    clientIdentity: string
  ): Promise<void>;
}

export interface EntitySchema {
  id: string;
  key: string;
  scopeId: string;
  obj: Record<string, unknown>;
  ownerId: string;
  owner: User;
}

export interface EntityChangeSchema {
  id: string;
  key: string;
  scopeId: string;
  rev: number;
  source: string;
  type: DatabaseChangeType;
  table: string;
  obj?: Record<string, unknown>;
  mods?: Record<string, unknown>;

  ownerId: string;
  owner: User;

  toChange(): IDatabaseChange;
}
