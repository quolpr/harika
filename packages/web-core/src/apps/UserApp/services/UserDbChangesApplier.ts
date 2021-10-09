import type { DbChangesWriterService } from '../../../extensions/SyncExtension/persistence/ApplyChangesService';
import type { IChangesApplier } from '../../../extensions/SyncExtension/serverSynchronizer/ServerSynchronizer';
import type { IDatabaseChange } from '../../../extensions/SyncExtension/serverSynchronizer/types';
import type { SqlVaultsRepository } from '../repositories/VaultsRepository';

export class UserDbChangesApplier implements IChangesApplier {
  constructor(
    private vaultsRepo: SqlVaultsRepository,
    private dbChangesWriter: DbChangesWriterService,
  ) {}

  async resolveChanges(
    _clientChanges: IDatabaseChange[],
    serverChanges: IDatabaseChange[],
  ) {
    this.dbChangesWriter.writeChanges(serverChanges, this.vaultsRepo, {
      shouldRecordChange: false,
      source: 'inDbChanges',
    });
  }
}
