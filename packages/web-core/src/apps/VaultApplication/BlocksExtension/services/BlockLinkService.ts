import { inject, injectable } from 'inversify';
import { map, Observable, of, switchMap, tap } from 'rxjs';

import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { blockLinkMapper } from '../mappers/blockLinkMapper';
import { BaseBlock } from '../models/BaseBlock';
import { BlockLinksStore } from '../models/BlockLinkStore';
import { AllBlocksRepository } from '../repositories/AllBlocksRepository';
import {
  BlockLinksRepository,
  blockLinksTable,
} from '../repositories/BlockLinkRepository';
import { AllBlocksService } from './AllBlocksService';

@injectable()
export class BlockLinkService {
  constructor(
    @inject(AllBlocksRepository)
    private allBlocksRepository: AllBlocksRepository,
    @inject(AllBlocksService)
    private allBlocksService: AllBlocksService,
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
