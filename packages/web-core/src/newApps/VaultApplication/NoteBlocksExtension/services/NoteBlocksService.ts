import { Remote } from 'comlink';
import { inject, injectable } from 'inversify';
import { isEqual } from 'lodash-es';
import { withoutUndo } from 'mobx-keystone';
import { from, Observable, of } from 'rxjs';
import { distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { toRemoteName } from '../../../../framework/utils';
import { toObserver } from '../../../../lib/toObserver';
import { blocksTreeDescriptorsMapper } from '../mappers/blocksTreeDescriptorsMapper';
import { noteBlocksMapper } from '../mappers/noteBlocksMapper';
import { NoteBlocksExtensionStore } from '../models/NoteBlocksExtensionStore';
import { BlocksTreeDescriptorsRepository } from '../repositories/BlockTreeDescriptorsRepository';
import {
  noteBlocksTable,
  NotesBlocksRepository,
} from '../repositories/NotesBlocksRepository';

@injectable()
export class NoteBlocksService {
  constructor(
    @inject(DbEventsListenService)
    private dbEventsService: DbEventsListenService,
    @inject(toRemoteName(NotesBlocksRepository))
    private notesBlocksRepository: Remote<NotesBlocksRepository>,
    @inject(toRemoteName(BlocksTreeDescriptorsRepository))
    private treeDescriptorsRepository: Remote<BlocksTreeDescriptorsRepository>,
    @inject(toRemoteName(NoteBlocksExtensionStore))
    private store: NoteBlocksExtensionStore,
  ) {}

  createBlocksTree(noteId: string, options?: { addEmptyBlock?: boolean }) {
    return this.store.createNewBlocksTree(noteId, options);
  }

  getBlocksRegistryByNoteId$(noteId: string) {
    return this.getBlocksRegistryByNoteIds$([noteId]).pipe(map(([res]) => res));
  }

  getBlocksRegistryByNoteIds$(notesIds: string[]) {
    const notLoadedTreeRegistryIds = notesIds.filter(
      (id) => !this.store.areBlocksOfNoteLoaded(id),
    );

    const loadTrees = async () => {
      const descriptorsAttrs = (
        await this.treeDescriptorsRepository.getByIds(notLoadedTreeRegistryIds)
      ).map((doc) => blocksTreeDescriptorsMapper.mapToModelData(doc));
      const blocksAttrs = (
        await this.notesBlocksRepository.getByNoteIds(notLoadedTreeRegistryIds)
      ).map((m) => noteBlocksMapper.mapToModelData(m));

      return {
        unloadedBlocksAttrs: blocksAttrs,
        unloadedDescriptorAttrs: descriptorsAttrs,
      };
    };

    const notLoadedNotes$ =
      notLoadedTreeRegistryIds.length > 0
        ? from(loadTrees())
        : of({
            unloadedBlocksAttrs: [],
            unloadedDescriptorAttrs: [],
          });

    return notLoadedNotes$.pipe(
      tap(({ unloadedBlocksAttrs, unloadedDescriptorAttrs }) => {
        withoutUndo(() => {
          this.store.loadBlocksTree(
            unloadedDescriptorAttrs,
            unloadedBlocksAttrs,
            true,
          );
        });
      }),
      switchMap(() =>
        toObserver(() => {
          return notesIds.map((id) => this.store.getBlocksRegistryByNoteId(id));
        }),
      ),
      distinctUntilChanged((a, b) => isEqual(a, b)),
    );
  }

  getLinkedBlocksOfBlocksOfNote$(
    noteId: string,
  ): Observable<Record<string, { noteId: string; blockId: string }[]>> {
    return from(
      this.dbEventsService.liveQuery(
        [noteBlocksTable],
        () => this.notesBlocksRepository.getLinkedBlocksOfBlocksOfNote(noteId),
        false,
      ),
    );
  }

  getBlockById$(blockId: string) {
    return from(
      this.dbEventsService.liveQuery([noteBlocksTable], () =>
        this.notesBlocksRepository.getNoteIdByBlockId(blockId),
      ),
    ).pipe(
      switchMap((noteId) =>
        noteId ? this.getBlocksRegistryByNoteId$(blockId) : of(undefined),
      ),
      map((registry) => registry?.rootBlock),
    );
  }
}
