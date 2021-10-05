import { initSyncTables } from '../../apps/apps-migrations/initSyncTables';
import { DB } from '../../extensions/DbExtension/DB';
import { SyncRepository } from '../../lib/db/sync/persistence/SyncRepository';
import { DB_NAME, MIGRATIONS } from '../../lib/db/types';
import { APPLICATION_ID, APPLICATION_NAME } from '../../framework/types';
import { BaseExtension } from '../../framework/BaseExtension';

export default class VaultWorkerProvider extends BaseExtension {
  async register() {
    this.container
      .bind(DB_NAME)
      .toConstantValue(
        `${this.container.get(APPLICATION_NAME)}_${this.container.get(
          APPLICATION_ID,
        )}`,
      );

    this.container.bind(DB).toSelf();
    this.container.bind(SyncRepository).toSelf();

    this.container.bind(MIGRATIONS).toConstantValue(initSyncTables);
  }

  async initialize() {
    await this.container.get(DB).init(this.container.getAll(MIGRATIONS));
  }
}
