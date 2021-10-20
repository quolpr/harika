import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import {
  SYNC_URL,
  SYNC_AUTH_TOKEN,
} from '../../extensions/SyncExtension/types';
import { BaseApplication } from '../../framework/BaseApplication';
import { UserVaultsService } from './UserExtension/app/services/UserVaultsService';
import { UserAppExtension } from './UserExtension/UserAppExtension';
// @ts-ignore
import UserRootWorker from './UserRootWorker?worker';

export class UserApplication extends BaseApplication {
  constructor(
    applicationId: string,
    private syncConfig: {
      url: string;
      authToken: string;
    },
  ) {
    super(applicationId);
  }

  async register() {
    this.container.bind(SYNC_URL).toConstantValue(this.syncConfig.url);
    this.container
      .bind(SYNC_AUTH_TOKEN)
      .toConstantValue(this.syncConfig.authToken);
  }

  getVaultsService() {
    return this.container.get(UserVaultsService);
  }

  get applicationName() {
    return 'user';
  }

  get workerClass() {
    return UserRootWorker;
  }

  get extensions() {
    return [DbAppExtension, SyncAppExtension, UserAppExtension];
  }
}
