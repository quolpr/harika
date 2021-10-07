import { Remote } from 'comlink';
import { inject, injectable } from 'inversify';
import { isEqual } from 'lodash-es';
import { withoutUndo } from 'mobx-keystone';
import { from, Observable, of } from 'rxjs';
import {
  distinctUntilChanged,
  first,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';
import { DbEventsListenService } from '../../../../extensions/SyncExtension/services/DbEventsListenerService';
import { toRemoteName } from '../../../../framework/utils';
import { toObserver } from '../../../../lib/toObserver';
import { convertNoteBlockDocToModelAttrs } from '../converters/toModels';
import { NoteBlocksExtensionStore } from '../models/NoteBlocksExtensionStore';
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
    @inject(NoteBlocksExtensionStore) private store: NoteBlocksExtensionStore,
  ) {}

  createBlocksTree(
    rootBlockId: string,
    noteId: string,
    options?: { addEmptyBlock?: boolean },
  ) {
    return this.store.createNewBlocksTree(rootBlockId, noteId, options);
  }

  getBlocksRegistryByNoteIds$(notesIds$: Observable<string[]>) {
    const notLoadedNotes$ = notesIds$.pipe(
      switchMap((notesIds) => {
        const notLoadedTreeRegistryIds = notesIds.filter(
          (id) => !this.store.areBlocksOfNoteLoaded(id),
        );

        return notLoadedTreeRegistryIds.length > 0
          ? from(
              this.dbEventsService.liveQuery([noteBlocksTable], async () =>
                (
                  await this.notesBlocksRepository.getByNoteIds(
                    notesIds.filter(
                      (id) => !this.store.areBlocksOfNoteLoaded(id),
                    ),
                  )
                ).map((m) => convertNoteBlockDocToModelAttrs(m)),
              ),
            ).pipe(
              first(),
              map((attrs) => ({ unloadedBlocksAttrs: attrs, notesIds })),
            )
          : of({ unloadedBlocksAttrs: [], notesIds });
      }),
    );

    return notLoadedNotes$.pipe(
      tap(({ unloadedBlocksAttrs }) => {
        withoutUndo(() => {
          this.store.createOrUpdateEntitiesFromAttrs(
            unloadedBlocksAttrs,
            // TODO: fix it
            {},
            true,
          );
        });
      }),
      switchMap(({ notesIds }) =>
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

  getBlockById$(
    blockId: string,
    scopedBy: { $modelId: string; $modelType: string },
    rootBlockViewId?: string,
  ) {
    return from(
      this.dbEventsService.liveQuery([noteBlocksTable], () =>
        this.notesBlocksRepository.getNoteIdByBlockId(blockId),
      ),
    ).pipe(
      switchMap((noteId) =>
        noteId
          ? this.getBlocksTree$(of({ noteId, scopedBy, rootBlockViewId }))
          : of(undefined),
      ),
      map((blocksScope) =>
        blocksScope ? blocksScope.rootScopedBlock : undefined,
      ),
    );
  }

  getBlocksTree$(noteId: string) {
    return this.getBlocksTrees$(arg$.pipe(map((arg) => [arg]))).pipe(
      map((scopes) => scopes[0]),
    );
  }

  getBlocksTrees$(noteIds: string[]) {
    return args$.pipe(
      switchMap((args) => {
        return this.findNoteByIds$(of(args.map(({ noteId }) => noteId))).pipe(
          map((notes) => {
            return args.map((arg) => {
              const note = notes.find((n) => n.$modelId === arg.noteId);

              if (!note) throw new Error('NoteModel not found');

              return {
                noteId: arg.noteId,
                scopedBy: arg.scopedBy,
                rootBlockViewId: arg.rootBlockViewId || note.rootBlockId,
              };
            });
          }),
        );
      }),
      switchMap((args) => {
        const notLoadedBlocksOfNotesIds = args
          .map(({ noteId }) => noteId)
          .filter(
            (noteId) => !this.vault.noteBlocksApp.areBlocksOfNoteLoaded(noteId),
          );

        if (notLoadedBlocksOfNotesIds.length > 0) {
          return from(
            (async () => {
              const noteBlockAttrs = await Promise.all(
                (
                  await this.notesBlocksRepository.getByNoteIds(
                    notLoadedBlocksOfNotesIds,
                  )
                ).map((m) => convertNoteBlockDocToModelAttrs(m)),
              );

              withoutUndo(() => {
                this.vault.createOrUpdateEntitiesFromAttrs(
                  [],
                  noteBlockAttrs,
                  true,
                );
              });

              return args;
            })(),
          );
        } else {
          return of(args);
        }
      }),
      switchMap(async (args) => {
        const scopesFromDb = Object.fromEntries(
          (
            await this.blocksScopesRepo.getByIds(
              args.map((arg) =>
                getScopeKey(
                  arg.noteId,
                  arg.scopedBy.$modelType,
                  arg.scopedBy.$modelId,
                  arg.rootBlockViewId,
                ),
              ),
            )
          ).map((doc) => [doc.id, doc]),
        );

        const argsWithKey = args.map((arg) => ({
          ...arg,
          key: getScopeKey(
            arg.noteId,
            arg.scopedBy.$modelType,
            arg.scopedBy.$modelId,
            arg.rootBlockViewId,
          ),
        }));

        const inDb = withoutSync(() => {
          return this.vault.noteBlocksApp.getOrCreateScopes(
            argsWithKey
              .filter((arg) => scopesFromDb[arg.key])
              .map((arg) => {
                return {
                  ...arg,
                  collapsedBlockIds: scopesFromDb[arg.key].collapsedBlockIds,
                };
              }),
          );
        });
        const notInDb = (() => {
          return this.vault.noteBlocksApp.getOrCreateScopes(
            argsWithKey
              .filter((arg) => !scopesFromDb[arg.key])
              .map((arg) => {
                return {
                  ...arg,
                  collapsedBlockIds: [],
                };
              }),
          );
        })();

        return [...inDb, ...notInDb];
      }),
      distinctUntilChanged((a, b) => isEqual(a, b)),
    );
  }
}
