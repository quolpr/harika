import type { User } from '../users/schemas/user.schema';
import type { IDatabaseChange, DatabaseChangeType } from '@harika/common';

export interface SyncEntitiesService {
  getChangesFromRev(
    scopeId: string,
    ownerId: string,
    rev: number,
    clientIdentity: string,
  ): Promise<{ changes: IDatabaseChange[]; lastRev: number }>;

  applyChanges(
    changes: IDatabaseChange[],
    scopeId: string,
    ownerId: string,
    clientIdentity: string,
  ): Promise<number>;

  getLastRev(scopeId: string, ownerId: string): Promise<number>;
}

export interface EntityChangeSchema {
  id: string;
  key: string;
  scopeId: string;
  rev: number;
  source: string;
  type: DatabaseChangeType;
  table: string;
  obj?: Record<string, any>;
  from?: Record<string, any>;
  to?: Record<string, any>;

  ownerId: string;
  owner: User;

  toChange(): IDatabaseChange;
}
