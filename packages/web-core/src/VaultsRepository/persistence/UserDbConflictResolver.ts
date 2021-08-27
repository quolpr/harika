import type { IDatabaseChange } from '../../dexieTypes';
import { applyChanges } from '../../dexie-sync/applyChanges';
import Dexie from 'dexie';
import type { IChangesApplier } from '../../dexie-sync/ServerSynchronizer';

export class UserDbConflictsResolver implements IChangesApplier {
  constructor(private db: Dexie) {}

  async resolveChanges(
    clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ) {
    // TODO: client/sercer conflicts resolution
    await this.db.transaction('rw', this.db.tables, async () => {
      // @ts-ignore
      Dexie.currentTransaction.source = 'serverChanges';
      await applyChanges(this.db, serverChanges);
    });
  }

  tables() {
    return [this.db.table('vaults')];
  }
}
