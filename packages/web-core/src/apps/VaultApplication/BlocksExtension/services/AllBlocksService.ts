import { inject, injectable, multiInject } from 'inversify';
import { ModelData } from 'mobx-keystone';

import { SyncConfig } from '../../../../extensions/SyncExtension/serverSynchronizer/SyncConfig';
import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { BaseBlock } from '../models/BaseBlock';
import { BlocksStore } from '../models/BlocksStore';
import {
  AllBlocksRepository,
  BaseBlockDoc,
} from '../repositories/AllBlocksRepository';
import { BaseBlockRepository } from '../repositories/BaseBlockRepository';
import { BLOCK_REPOSITORY } from '../types';

@injectable()
export class AllBlocksService {
  private blocksReposMap: Record<string, BaseBlockRepository>;

  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(AllBlocksRepository)
    private allBlocksRepository: AllBlocksRepository,
    @inject(BlocksStore)
    private store: BlocksStore,
    @inject(SyncConfig) private syncConfig: SyncConfig,
    @multiInject(BLOCK_REPOSITORY) blocksRepos: BaseBlockRepository[],
  ) {
    this.blocksReposMap = Object.fromEntries(
      blocksRepos.map((r) => [r.docType, r]),
    );
  }

  async loadBlocksTree(blockId: string) {
    await this.getBlockWithTreeByIds([blockId]);
  }

  loadBlocksTrees$(blockIds: string[]) {
    return this.dbEventsService.liveQuery(
      this.allBlocksRepository.blocksTables,
      () => this.loadBlocksTrees(blockIds),
    );
  }

  async loadBlocksTrees(blockIds: string[]) {
    return await this.getBlockWithTreeByIds(blockIds);
  }

  async getBlockWithTreeById(blockId: string, forceReload = false) {
    return (await this.getBlockWithTreeByIds([blockId], forceReload))[0];
  }

  async getSingleBlockByIds(blockIds: string[], forceReload = false) {
    const loadedBlocksMap: Record<string, BaseBlock> = Object.fromEntries(
      blockIds.map((id) => [id, this.store.getBlockById(id)] as const),
    );

    const notLoadedIds = blockIds.filter((id) => !loadedBlocksMap[id]);

    if (!forceReload && notLoadedIds.length === 0) {
      return Object.values(loadedBlocksMap);
    }

    const blocks = await this.allBlocksRepository.getSingleBlocksByIds(
      blockIds,
    );

    this.store.handleModelChanges(
      this.mapDocsToModelData(blocks).map(({ klass, datas }) => ({
        klass,
        datas: datas.map((data) => ({ ...data, areChildrenLoaded: false })),
      })),
      [],
    );

    return this.store.getBlocksByIds(blockIds).filter((b) => b !== undefined);
  }

  async getBlockWithTreeByIds(blockIds: string[], forceReload = false) {
    const loadedBlocksMap: Record<string, BaseBlock> = Object.fromEntries(
      blockIds
        .map((id) => [id, this.store.getBlockById(id)] as const)
        .filter(([, block]) => block !== undefined && block.isTreeFullyLoaded),
    );

    const notLoadedIds = blockIds.filter((id) => !loadedBlocksMap[id]);

    if (!forceReload && notLoadedIds.length === 0) {
      return Object.values(loadedBlocksMap);
    }

    const allBlocks = await this.allBlocksRepository.getDescendantsWithSelf(
      blockIds,
    );

    this.store.handleModelChanges(this.mapDocsToModelData(allBlocks), []);

    return this.store.getBlocksByIds(blockIds);
  }

  private mapDocsToModelData(docs: BaseBlockDoc[]) {
    return docs.map((d) => {
      // TODO: looks to complicated. It's better to refactor
      const mapper = this.syncConfig.getRegistrationByCollectionName(
        this.blocksReposMap[d.type].getTableName(),
      )!.mapper;

      return {
        klass: mapper.model,
        datas: [
          mapper.mapToModelData(d) as ModelData<BaseBlock> & {
            $modelType: string;
          },
        ],
      };
    });
  }
}
