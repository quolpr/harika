import { inject, injectable } from 'inversify';
import { map } from 'rxjs';

import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { blockLinkMapper } from '../mappers/blockLinkMapper';
import { BlockLinksStore } from '../models/BlockLinkStore';
import {
  BlockLinksRepository,
  blockLinksTable,
} from '../repositories/BlockLinkRepository';

@injectable()
export class BlockLinkService {
  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(BlockLinksRepository)
    private blockLinksRepository: BlockLinksRepository,
    @inject(BlockLinksStore)
    private blockLinkStore: BlockLinksStore,
  ) {}

  async loadLinksOfBlockDescendants(rootBlockIds: string[]) {
    if (rootBlockIds.length === 0) return [];

    const links = await this.blockLinksRepository.getLinksOfDescendants(
      rootBlockIds,
    );

    return this.blockLinkStore.handleModelChanges(
      links.map((doc) => blockLinkMapper.mapToModelData(doc)),
      [],
    );
  }

  loadLinksOfBlockDescendants$(rootBlockIds: string[]) {
    return this.dbEventsService.liveQuery(
      [blockLinksTable],
      () => this.loadLinksOfBlockDescendants(rootBlockIds),
      false,
    );
  }

  loadBacklinkedBlocks$(rootBlockId: string) {
    return this.dbEventsService
      .liveQuery(
        [blockLinksTable],
        () => this.blockLinksRepository.getBacklinksOfDescendants(rootBlockId),
        false,
      )
      .pipe(
        map((res) => {
          return {
            links: this.blockLinkStore.handleModelChanges(
              res.links.map((doc) => blockLinkMapper.mapToModelData(doc)),
              [],
            ),
            rootsIds: res.rootBlockIdsOfLinkedBlocks,
          };
        }),
      );
  }
}
