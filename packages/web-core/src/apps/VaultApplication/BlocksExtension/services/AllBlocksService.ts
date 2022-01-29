import { inject, injectable, multiInject } from 'inversify';
import { ModelData, SnapshotInOf } from 'mobx-keystone';
import { from, map, Observable, of, switchMap, take, tap } from 'rxjs';
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

  getBlockById$(blockId: string, forceReload = false) {
    return this.getBlockByIds$([blockId], forceReload).pipe(
      map((blocks) => blocks[0]),
    );
  }

  // TODO: remove rxjs
  getBlockByIds$(blockIds: string[], forceReload = false) {
    const blocksMap: Record<string, BaseBlock> = Object.fromEntries(
      blockIds
        .map((id) => [id, this.store.getBlockById(id)])
        .filter(([, block]) => block !== undefined),
    );

    const notLoadedIds = blockIds.filter((id) => !blocksMap[id]);

    if (!forceReload && notLoadedIds.length === 0) {
      return of(Object.values(blocksMap));
    }

    return from(
      this.dbEventsService.liveQuery(
        this.allBlocksRepository.blocksTables,
        () => this.allBlocksRepository.getDescendantsWithSelf(blockIds),
      ),
    ).pipe(
      tap((allBlocks) =>
        allBlocks
          ? this.store.handleModelChanges(
              this.mapDocsToModelData(allBlocks),
              [],
            )
          : undefined,
      ),
      map(() => this.store.getBlocksByIds(blockIds)),
      take(1),
    );
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
