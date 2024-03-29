import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { ISyncConfig, SYNC_CONFIG } from '../../extensions/SyncExtension/types';
import { BaseApplication } from '../../framework/BaseApplication';
import { UserVaultsService } from './UserExtension/services/UserVaultsService';
import { UserAppExtension } from './UserExtension/UserAppExtension';

export class UserApplication extends BaseApplication {
  constructor(applicationId: string, private syncUrl: ISyncConfig) {
    super(applicationId);
  }

  async register() {
    this.container.bind(SYNC_CONFIG).toConstantValue(this.syncUrl);
  }

  getVaultsService() {
    return this.container.get(UserVaultsService);
  }

  get applicationName() {
    return 'user';
  }

  get extensions() {
    return [DbAppExtension, SyncAppExtension, UserAppExtension];
  }
}
