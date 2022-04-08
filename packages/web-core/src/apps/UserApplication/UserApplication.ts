import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { SYNC_URL } from '../../extensions/SyncExtension/types';
import { BaseApplication } from '../../framework/BaseApplication';
import { UserVaultsService } from './UserExtension/services/UserVaultsService';
import { UserAppExtension } from './UserExtension/UserAppExtension';

export class UserApplication extends BaseApplication {
  constructor(applicationId: string, private syncUrl: string) {
    super(applicationId);
  }

  async register() {
    this.container.bind(SYNC_URL).toConstantValue(this.syncUrl);
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
