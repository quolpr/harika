import { initSyncTables } from './migrations/initSyncTables';
import { BaseExtension } from '../../framework/BaseExtension';
import { SyncRepository } from './persistence/SyncRepository';
import { MIGRATIONS } from '../DbExtension/types';
import { DbEventsService } from './DbEventsService';

export default class SyncWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(SyncRepository).toSelf();
    this.container.bind(MIGRATIONS).toConstantValue(initSyncTables);
  }
}
