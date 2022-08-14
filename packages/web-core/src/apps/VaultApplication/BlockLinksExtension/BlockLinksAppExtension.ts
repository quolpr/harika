import { injectable } from 'inversify';

import { BaseSyncExtension } from '../../../extensions/SyncExtension/BaseSyncExtension';
import { SyncConfig } from '../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { blockLinkMapper } from './mappers/blockLinkMapper';
import { createBlocksLinksTable } from './migrations/createBlocksLinksTable';
import { BlockLink } from './models/BlockLink';
import { BlockLinksStore } from './models/BlockLinkStore';
import { BlockLinksRepository } from './repositories/BlockLinkRepository';
import { BlockLinkService } from './services/BlockLinkService';
import { UpdateLinksService } from './services/UpdateLinksService';

@injectable()
export class BlockLinksAppExtension extends BaseSyncExtension {
  async register() {
    await super.register();

    this.container.bind(UpdateLinksService).toSelf();
    this.container
      .bind(BlockLinksStore)
      .toConstantValue(new BlockLinksStore({}));
    this.container.bind(BlockLinkService).toSelf();
  }

  async initialize() {
    const syncConfig = this.container.get(SyncConfig);
    const linksStore = this.container.get(BlockLinksStore);

    this.container.resolve(UpdateLinksService);

    const disposes: (() => void)[] = [];

    disposes.push(
      syncConfig.registerSyncRepo(blockLinkMapper, BlockLinksRepository),
    );

    disposes.push(
      syncConfig.onModelChange([BlockLink], (attrs, deletedIds) => {
        const [linksAttrs] = attrs;

        linksStore.handleModelChanges(linksAttrs, deletedIds.flat());
      }),
    );

    return () => {
      disposes.forEach((d) => d());
    };
  }

  repos() {
    return [{ repo: BlockLinksRepository, withSync: true }];
  }

  migrations() {
    return [createBlocksLinksTable];
  }
}
