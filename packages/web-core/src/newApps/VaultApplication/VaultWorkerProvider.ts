import { initSyncTables } from '../../apps/apps-migrations/initSyncTables';
import { BaseWorkerProvider } from '../../lib/BaseWorkerProvider';
import { DB } from '../../lib/db/core/DB';
import { SyncRepository } from '../../lib/db/sync/persistence/SyncRepository';
import { DB_NAME, MIGRATIONS } from '../../lib/db/types';
import { APPLICATION_ID, APPLICATION_NAME } from '../../lib/types';

export default class VaultWorkerProvider extends BaseWorkerProvider {
  async register() {
    this.workerContainer
      .bind(DB_NAME)
      .toConstantValue(
        `${this.workerContainer.get(
          APPLICATION_NAME,
        )}_${this.workerContainer.get(APPLICATION_ID)}`,
      );

    this.workerContainer.bind(DB).toSelf();
    this.workerContainer.bind(SyncRepository).toSelf();

    this.workerContainer.bind(MIGRATIONS).toConstantValue(initSyncTables);
  }

  async initialize() {
    await this.workerContainer
      .get(DB)
      .init(this.workerContainer.getAll(MIGRATIONS));
  }
}
