import { injectable } from 'inversify';
import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { BlocksScopeStore } from './models/BlocksScopeStore';
import { BlocksScopesService } from './services/BlocksScopeService';
import { SyncConfig } from '../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { blocksScopesMapper } from './mappers/blockScopesMapper';
import { BlocksScopesRepository } from './repositories/BlockScopesRepository';
import { BlocksScope } from './models/BlocksScope';
import { addBlockScopeTable } from './migrations/addBlockScopeTable';

@injectable()
export class BlockScopesAppExtension extends BaseSyncExtension {
  async register() {
    await super.register();

    const scopeStore = new BlocksScopeStore({});

    this.container.bind(BlocksScopeStore).toConstantValue(scopeStore);
    this.container.bind(BlocksScopesService).toSelf();
  }

  async initialize() {
    const scopesStore = this.container.get(BlocksScopeStore);
    const syncConfig = this.container.get(SyncConfig);

    const disposes: (() => void)[] = [];

    disposes.push(
      syncConfig.registerSyncRepo(blocksScopesMapper, BlocksScopesRepository),
    );

    disposes.push(
      syncConfig.onModelChange([BlocksScope], (attrs, deletedIds) => {
        const [scopeAttrs] = attrs;

        scopesStore.handleModelChanges(scopeAttrs, deletedIds.flat());
      }),
    );

    return () => {
      disposes.forEach((d) => d());
    };
  }

  repos() {
    return [{ repo: BlocksScopesRepository, withSync: true }];
  }

  migrations() {
    return [addBlockScopeTable];
  }
}
