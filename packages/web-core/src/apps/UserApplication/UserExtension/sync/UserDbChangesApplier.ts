import type { IChangesApplier } from '../../../../extensions/SyncExtension/serverSynchronizer/ServerSynchronizer';
import type { IDatabaseChange } from '../../../../extensions/SyncExtension/serverSynchronizer/types';

export class UserDbChangesApplier implements IChangesApplier {
  async resolveChanges(
    _clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ) {
    return serverChanges;
  }
}
