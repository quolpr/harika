import { inject, injectable } from 'inversify';
import { map, Observable, switchMap } from 'rxjs';

import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { blockLinkMapper } from '../mappers/blockLinkMapper';
import { BaseBlock } from '../models/BaseBlock';
import { BlockLinksStore } from '../models/BlockLinkStore';
import { AllBlocksRepository } from '../repositories/AllBlocksRepository';
import { BlockLinksRepository } from '../repositories/BlockLinkRepository';
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

  getBacklinkedBlocks$(
    rootBlockId: string,
  ): Observable<{ rootBlock: BaseBlock; blocks: BaseBlock[] }[]> {
    return this.dbEventsService
      .liveQuery(
        this.allBlocksRepository.blocksTables,
        () => this.blockLinksRepository.getBacklinksOfDescendants(rootBlockId),
        false,
      )
      .pipe(
        switchMap(async (res) => {
          await this.allBlocksService.loadBlocksTrees(
            res.rootBlockIdsOfLinkedBlocks,
          );

          return this.blockLinkStore.handleModelChanges(
            res.links.map((doc) => blockLinkMapper.mapToModelData(doc)),
            [],
          );
        }),
        map((blocks) => {
          const groupedBlocks: Map<BaseBlock, BaseBlock[]> = new Map();

          blocks.forEach((b) => {
            if (groupedBlocks.has(b.blockRef.current.root)) {
              groupedBlocks
                .get(b.blockRef.current.root)!
                .push(b.blockRef.current);
            } else {
              groupedBlocks.set(b.blockRef.current.root, [b.blockRef.current]);
            }
          });

          const res = Array.from(groupedBlocks.entries()).map(
            ([rootBlock, blocks]) => ({
              rootBlock,
              blocks,
            }),
          );

          return res;
        }),
      );
  }
}
