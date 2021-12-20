import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { GET_AUTH_TOKEN, SYNC_URL } from '../../extensions/SyncExtension/types';
import { BaseApplication } from '../../framework/BaseApplication';
import { UserVaultsService } from './UserExtension/services/UserVaultsService';
import { UserAppExtension } from './UserExtension/UserAppExtension';

export class UserApplication extends BaseApplication {
  constructor(
    applicationId: string,
    private syncUrl: string,
    private getAuthToken: () => Promise<string | undefined>,
  ) {
    super(applicationId);
  }

  async initialize() {
    this.container.bind(GET_AUTH_TOKEN).toConstantValue(this.getAuthToken);
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
