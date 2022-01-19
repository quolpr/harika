import { inject, injectable } from 'inversify';
import { from, Observable, of } from 'rxjs';
import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { BlocksStore } from '../models/BlocksStore';
import { AllBlocksRepository } from '../repositories/AllBlocksRepository';

@injectable()
export class AllBlocksService {
  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(AllBlocksRepository)
    private allBlocksRepository: AllBlocksRepository,
    @inject(BlocksStore)
    private store: BlocksStore,
  ) {}

  getLinkedBlocksOfBlocksOfBlock$(
    noteId: string,
  ): Observable<Record<string, { noteId: string; blockId: string }[]>> {
    return of({});
  }

  getBlockWithChildrenById(blockId: string) {
    if (this.store.getBlockById(blockId)) {
      return of(this.store.getBlockById(blockId));
    }
  }

  getLinkedBlocksOfBlocksOfRootBlock$(rootBlockId: string) {}

  getLinksOfBlockId$(noteId: string) {}
}
