import { DB_MIGRATIONS } from '../../../extensions/DbExtension/types';
import { BaseExtension } from '../../../framework/BaseExtension';
import { toRemoteName } from '../../../framework/utils';
import { initUsersDbTables } from './migrations/initUsersDbTables';
import { VaultsRepository } from './repositories/VaultsRepository';

export default class NotesWorkerExtension extends BaseExtension {
  async register() {
    this.container.bind(VaultsRepository).toSelf();
    this.container.bind(DB_MIGRATIONS).toConstantValue(initUsersDbTables);

    this.container
      .bind(toRemoteName(VaultsRepository))
      .toDynamicValue(() => this.container.get(VaultsRepository));
  }
}
