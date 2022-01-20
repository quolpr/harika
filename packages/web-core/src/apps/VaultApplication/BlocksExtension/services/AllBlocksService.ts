import { inject, injectable, multiInject } from 'inversify';
import { SnapshotInOf } from 'mobx-keystone';
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

  async getBlockById(blockId: string) {
    return from(
      this.dbEventsService.liveQuery(
        this.allBlocksRepository.blocksTables,
        () => this.allBlocksRepository.getRootIdByBlockId(blockId),
      ),
    ).pipe(
      switchMap((rootBlockId) =>
        rootBlockId
          ? this.allBlocksRepository.getDescendantsWithSelf([rootBlockId])
          : of(undefined),
      ),
      tap((allBlocks) =>
        allBlocks
          ? this.store.handleModelChanges(
              this.mapDocsToModelData(allBlocks),
              [],
            )
          : undefined,
      ),
      map(() => this.store.getBlockById(blockId)),
      take(1),
    );
  }

  getLinkedBlocksOfBlocksOfRootBlock$(
    rootBlockId: string,
  ): Observable<Record<string, { noteId: string; blockId: string }[]>> {
    return of({});
  }

  private mapDocsToModelData(docs: BaseBlockDoc[]) {
    return docs.map(
      (d) =>
        // TODO: looks to complicated. It's better to refactor
        this.syncConfig
          .getRegistrationByCollectionName(
            this.blocksReposMap[d.type].getTableName(),
          )!
          .mapper.mapToModelData(d) as SnapshotInOf<BaseBlock>,
    );
  }
}
