import { BlocksScopesRepository } from './worker/repositories/BlockScopesRepository';
import { addBlockScopeTable } from './worker/migrations/addBlockScopeTable';
import { BaseSyncWorkerExtension } from '../../../extensions/SyncExtension/BaseSyncWorkerExtension';

export default class BlocksScopeWorkerExtension extends BaseSyncWorkerExtension {
  repos() {
    return [{ repo: BlocksScopesRepository, withSync: true, remote: true }];
  }

  migrations() {
    return [addBlockScopeTable];
  }
}
