import type { DbChangesWriterService } from '../../db-sync/persistence/ApplyChangesService';
import type { IChangesApplier } from '../../db-sync/synchronizer/ServerSynchronizer';
import type { IDatabaseChange } from '../../db-sync/synchronizer/types';
import type { SqlVaultsRepository } from './VaultsRepository';

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
