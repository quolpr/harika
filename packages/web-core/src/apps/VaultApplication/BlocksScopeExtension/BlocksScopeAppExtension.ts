import { injectable } from 'inversify';
import { BlocksScopesRepository } from './repositories/BlockScopesRepository';
import { SyncConfig } from '../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { blocksScopesMapper } from './mappers/blockScopesMapper';
import { BlocksScope } from './models/BlocksScope';
import { BlocksScopeStore } from './models/BlocksScopeStore';
import { BlocksScopesService } from './services/BlocksScopeService';
import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { addBlockScopeTable } from './migrations/addBlockScopeTable';

@injectable()
export class BlocksScopeAppExtension extends BaseSyncExtension {
  async register() {
    await super.register();

    this.container
      .bind(BlocksScopeStore)
      .toConstantValue(new BlocksScopeStore({}));
    this.container.bind(BlocksScopesService).toSelf();
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

  repos() {
    return [{ repo: BlocksScopesRepository, withSync: true, remote: true }];
  }

  migrations() {
    return [addBlockScopeTable];
  }
}