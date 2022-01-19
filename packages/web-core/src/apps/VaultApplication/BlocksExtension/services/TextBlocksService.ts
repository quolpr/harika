import { inject, injectable } from 'inversify';
import { from, Observable, of } from 'rxjs';
import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { BlocksStore } from '../models/BlocksStore';
import {
  TextBlocksRepository,
  textBlocksTable,
} from '../repositories/TextBlocksRepository';

@injectable()
export class TextBlocksService {
  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(TextBlocksRepository)
    private textBlocksRepository: TextBlocksRepository,
    @inject(BlocksStore)
    private store: BlocksStore,
  ) {}

  getBlockById$(blockId: string) {
    if (this.store.getNoteBlock(blockId)) {
      return of(this.store.getNoteBlock(blockId));
    }

    return from(
      this.dbEventsService.liveQuery([noteBlocksTable], () =>
        this.textBlocksRepository.getNoteIdByBlockId(blockId),
      ),
    ).pipe(
      switchMap((noteId) =>
        noteId ? this.getBlocksRegistryByNoteId$(blockId) : of(undefined),
      ),
      map((registry) => registry?.getBlockById(blockId)),
    );
  }

  getLinksOfNoteId$(noteId: string) {
    return from(
      this.dbEventsService.liveQuery(
        [noteBlocksTable, noteBlocksTable],
        () => this.textBlocksRepository.getLinksOfNoteId(noteId),
        false,
      ),
    );
  }

  getNoteIdByBlockId$(blockId: string) {
    return from(
      this.dbEventsService.liveQuery([noteBlocksTable], () =>
        this.textBlocksRepository.getNoteIdByBlockId(blockId),
      ),
    );
  }
}
