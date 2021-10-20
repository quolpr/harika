import { injectable } from 'inversify';
import { VaultsRepository } from './worker/repositories/VaultsRepository';
import { UserVaultsService } from './app/services/UserVaultsService';
import { BaseAppExtension } from '../../../framework/BaseAppExtension';

@injectable()
export class UserAppExtension extends BaseAppExtension {
  async register() {
    this.container.bind(UserVaultsService).toSelf();

    await this.bindRemote(VaultsRepository);
  }
}
