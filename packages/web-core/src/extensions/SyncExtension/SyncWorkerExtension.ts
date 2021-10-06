import { initSyncTables } from './migrations/initSyncTables';
import { BaseExtension } from '../../framework/BaseExtension';
import { SyncRepository } from './persistence/SyncRepository';
import { DB_MIGRATIONS } from '../DbExtension/types';
import { DbEventsSenderService } from './services/DbEventsSenderService';

export default class SyncWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(SyncRepository).toSelf();
    this.container.bind(DB_MIGRATIONS).toConstantValue(initSyncTables);
  }

  async initialize() {
    this.container.resolve(DbEventsSenderService).initialize();
  }
}
