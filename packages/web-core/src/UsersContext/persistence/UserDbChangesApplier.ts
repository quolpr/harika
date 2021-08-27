import type { IDatabaseChange } from '../../dexieTypes';
import type { IChangesApplier } from '../../dexie-sync/ServerSynchronizer';
import type {
  DbChangesWriterService,
  SqlVaultsRepository,
} from '../../SqlNotesRepository.worker';

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
