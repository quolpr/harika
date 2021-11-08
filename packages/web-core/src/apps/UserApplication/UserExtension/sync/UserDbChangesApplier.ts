import type { IChangesApplier } from '../../../../extensions/SyncExtension/serverSynchronizer/ServerSynchronizer';
import type { IDatabaseChange } from '../../../../extensions/SyncExtension/serverSynchronizer/types';

export class UserDbChangesApplier implements IChangesApplier {
  resolveChanges(
    _clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ) {
    return { notConflictedServerChanges: serverChanges, conflictedChanges: [] };
  }
}
