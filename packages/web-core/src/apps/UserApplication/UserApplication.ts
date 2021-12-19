import { DbAppExtension } from '../../extensions/DbExtension/DbAppExtension';
import { SyncAppExtension } from '../../extensions/SyncExtension/SyncAppExtension';
import { SyncConnectionConfig } from '../../extensions/SyncExtension/SyncConnectionConfig';
import { BaseApplication } from '../../framework/BaseApplication';
import { UserVaultsService } from './UserExtension/services/UserVaultsService';
import { UserAppExtension } from './UserExtension/UserAppExtension';

export class UserApplication extends BaseApplication {
  setSyncConfig(syncConfig: { url: string; authToken: string }) {
    this.container.get(SyncConnectionConfig).config$.next(syncConfig);
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
