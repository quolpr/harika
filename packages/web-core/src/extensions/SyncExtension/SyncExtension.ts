import { initSyncTables } from './migrations/initSyncTables';
import { BaseExtension } from '../../framework/BaseExtension';
import { SyncRepository } from './persistence/SyncRepository';
import { MIGRATIONS } from '../DbExtension/types';

export default class SyncExtension extends BaseExtension {
  async register() {
    this.container.bind(SyncRepository).toSelf();
    this.container.bind(MIGRATIONS).toConstantValue(initSyncTables);
  }
}
