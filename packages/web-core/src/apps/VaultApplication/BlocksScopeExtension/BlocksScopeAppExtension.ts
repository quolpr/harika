import { inject, injectable } from 'inversify';
import { BaseExtension } from '../../../framework/BaseExtension';
import { BlocksScopesRepository } from './worker/repositories/BlockScopesRepository';
import { RemoteRegister } from '../../../framework/RemoteRegister';
import { SyncConfig } from '../../../extensions/SyncExtension/app/serverSynchronizer/SyncConfig';
import { blocksScopesMapper } from './app/mappers/blockScopesMapper';
import { BlocksScope } from './app/models/BlocksScope';
import { BlocksScopeStore } from './app/models/BlocksScopeStore';
import { BlocksScopesService } from './app/services/BlocksScopeService';

@injectable()
export class BlocksScopeAppExtension extends BaseExtension {
  constructor(@inject(RemoteRegister) private remoteRegister: RemoteRegister) {
    super();
  }

  async register() {
    this.container
      .bind(BlocksScopeStore)
      .toConstantValue(new BlocksScopeStore({}));
    this.container.bind(BlocksScopesService).toSelf();

    await this.remoteRegister.registerRemote(BlocksScopesRepository);
  }

  async initialize() {
    const store = this.container.get(BlocksScopeStore);
    const syncConfig = this.container.get(SyncConfig);

    const disposesSyncRepo = syncConfig.registerSyncRepo(
      blocksScopesMapper,
      BlocksScopesRepository,
    );

    const disposeModelChange = syncConfig.onModelChange(
      [BlocksScope],
      (attrs, deletedIds) => {
        const [scopeAttrs] = attrs;

        store.handleModelChanges(scopeAttrs, deletedIds);
      },
    );

    return () => {
      disposesSyncRepo();
      disposeModelChange();
    };
  }
}
