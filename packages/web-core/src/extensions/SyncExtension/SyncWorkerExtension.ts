import { initSyncTables } from './worker/migrations/initSyncTables';
import { BaseExtension } from '../../framework/BaseExtension';
import { SyncRepository } from './worker/repositories/SyncRepository';
import { DB_MIGRATIONS } from '../DbExtension/types';
import { DbEventsSenderService } from './worker/services/DbEventsSenderService';
import { injectable } from 'inversify';
import { toRemoteName } from '../../framework/utils';
import { ApplyChangesService } from './worker/services/ApplyChangesService';

@injectable()
export default class SyncWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(ApplyChangesService).toSelf();
    this.container.bind(SyncRepository).toSelf();

    this.container.bind(DB_MIGRATIONS).toConstantValue(initSyncTables);

    this.container
      .bind(toRemoteName(SyncRepository))
      .toDynamicValue(() => this.container.get(SyncRepository));
    this.container
      .bind(toRemoteName(ApplyChangesService))
      .toDynamicValue(() => this.container.get(ApplyChangesService));
  }

  async initialize() {
    this.container.resolve(DbEventsSenderService).initialize();
  }
}
