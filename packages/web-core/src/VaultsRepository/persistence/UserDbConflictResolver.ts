import type { IDatabaseChange } from '../../dexieTypes';
import { applyChanges } from '../../dexie-sync/applyChanges';
import type Dexie from 'dexie';
import type { IConflictsResolver } from '../../dexie-sync/ServerSynchronizer';

export class UserDbConflictsResolver implements IConflictsResolver {
  constructor(private db: Dexie) {}

  async resolveChanges(
    clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ) {
    await applyChanges(this.db, serverChanges);
  }

  tables() {
    return [this.db.table('vaults')];
  }
}
