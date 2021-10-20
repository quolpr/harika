import { inject, injectable } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { RemoteRegister } from '../../../framework/RemoteRegister';
import { VaultsRepository } from './worker/repositories/VaultsRepository';
import { UserVaultsService } from './app/services/UserVaultsService';

@injectable()
export class UserAppExtension extends BaseExtension {
  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {
    super();
  }

  async register() {
    this.container.bind(UserVaultsService).toSelf();
    await this.remoteRegister.registerRemote(VaultsRepository);
  }
}
