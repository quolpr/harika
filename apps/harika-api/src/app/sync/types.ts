import { User } from '../users/schemas/user.schema';
import { IDatabaseChange, DatabaseChangeType } from '@harika/harika-core';

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
