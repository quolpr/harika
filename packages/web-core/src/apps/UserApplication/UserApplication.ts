import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { BaseApplication } from '../../framework/BaseApplication';
import { UserVaultsService } from './UserExtension/services/UserVaultsService';
import { UserExtension } from './UserExtension/UserExtension';
import { UserRootWorker } from './UserRootWorker';

export class UserApplication extends BaseApplication {
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
    return [DbAppExtension, SyncAppExtension, UserExtension];
  }
}
