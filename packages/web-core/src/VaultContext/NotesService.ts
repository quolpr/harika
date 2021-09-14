/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ModelCreationData } from 'mobx-keystone';
import type { Dayjs } from 'dayjs';
import type { NoteModel } from './domain/NotesApp/models/NoteModel';
import type { Optional } from 'utility-types';
import type { Required } from 'utility-types';
import type { ICreationResult } from './types';
import type { Vault } from './domain/Vault';
import {
  concatMap,
  distinctUntilChanged,
  first,
  map,
  mapTo,
  mergeAll,
  mergeMap,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';
import { isEqual, uniq } from 'lodash-es';
import { filterAst } from '../blockParser/astHelpers';
import type { RefToken, TagToken } from '../blockParser/types';
import { firstValueFrom, from, merge, Observable, of, Subject } from 'rxjs';
import type { NoteDocType } from '../dexieTypes';
import { VaultDbTables } from '../dexieTypes';
import {
  convertNoteBlockDocToModelAttrs,
  convertNoteDocToModelAttrs,
  convertViewToModelAttrs,
} from './syncers/toDomainModelsConverters';
import { NotesChangesTrackerService } from './services/notes-tree/NotesChangesTrackerService';
import dayjs from 'dayjs';
import { toObserver } from '../toObserver';
import type {
  SqlBlocksViewsRepository,
  SqlNotesBlocksRepository,
  SqlNotesRepository,
} from '../SqlNotesRepository';
import type { Remote } from 'comlink';
import type { DbEventsService } from '../DbEventsService';
import type {
  DeleteNoteService,
  FindNoteOrBlockService,
  ImportExportService,
} from '../VaultDb.worker';
import type { BlocksScope } from './domain/NoteBlocksApp/views/BlocksScope';
import { getScopeKey } from './domain/NoteBlocksApp/NoteBlocksApp';

export { NoteModel } from './domain/NotesApp/models/NoteModel';
export { Vault } from './domain/Vault';
export {
  NoteBlockModel,
  noteBlockRef,
} from './domain/NoteBlocksApp/models/NoteBlockModel';

// Document = Dexie doc
// Model = DDD model
// Tuple = plain object data, used for fast data getting

export class NotesService {
  private stopSubject = new Subject<unknown>();
  private stop$ = this.stopSubject.pipe(take(1));

  constructor(
    private notesRepository: Remote<SqlNotesRepository>,
    private notesBlocksRepository: Remote<SqlNotesBlocksRepository>,
    private blocksViewsRepo: Remote<SqlBlocksViewsRepository>,
    private dbEventsService: DbEventsService,
    private importExportService: Remote<ImportExportService>,
    private deleteNoteService: Remote<DeleteNoteService>,
    private findService: Remote<FindNoteOrBlockService>,
    public vault: Vault,
  ) {}

  async initialize() {
    new NotesChangesTrackerService(
      this.dbEventsService.changesChannel$(),
      this.vault.notesTree,
      this.stop$,
    );

    // this.vault.initializeNotesTree(
    //   (await this.notesRepository.getAll())
    //     .filter(({ dailyNoteDate, title }) => !dailyNoteDate)
    //     .map(({ id, title }) => ({
    //       id,
    //       title,
    //     })),
    // );
  }

  async fixDailyNotes() {
    await this.notesRepository.bulkUpdate(
      (
        await this.notesRepository.getAll()
      ).map((rec) => {
        return rec.dailyNoteDate &&
          dayjs(rec.dailyNoteDate).format('D MMM YYYY') !== rec.title
          ? { ...rec, dailyNoteDate: null }
          : rec;
      }),
      {
        shouldRecordChange: true,
        source: 'inDbChanges',
      },
    );
  }

  async updateNoteTitle(noteId: string, newTitle: string) {
    const exists = await this.isNoteExists(newTitle);

    if (exists) return 'exists' as const;

    const note = await this.findNote(noteId);

    if (!note) return;

    const oldTitle = note.title;

    (
      await firstValueFrom(
        this.getBlocksRegistryByNoteIds$(
          this.getLinksOfNote$(noteId).pipe(
            map((links) => links.map(({ note: { $modelId } }) => $modelId)),
          ),
        ),
      )
    )
      .flatMap((holder) => holder.getLinkedBlocksOfNoteId(noteId))
      .map((block) => block.content.updateTitle(oldTitle, newTitle));

    note.updateTitle(newTitle);

    return 'ok';
  }

  async createNote(
    attrs: Required<
      Optional<
        ModelCreationData<NoteModel>,
        'createdAt' | 'updatedAt' | 'dailyNoteDate' | 'rootBlockId'
      >,
      'title'
    >,
    options?: { isDaily?: boolean },
  ) {
    options = { isDaily: false, ...options };

    if (attrs.title.trim().length === 0) {
      return {
        status: 'error',
        errors: { title: ["Can't be empty"] },
      } as ICreationResult<NoteModel>;
    }

    if (await this.notesRepository.getIsExistsByTitle(attrs.title)) {
      return {
        status: 'error',
        errors: { title: ['Already exists'] },
      } as ICreationResult<NoteModel>;
    }

    return {
      status: 'ok',
      data: this.vault.newNote(attrs, options).note,
    } as ICreationResult<NoteModel>;
  }

  async getOrCreateDailyNote(this: NotesService, date: Dayjs) {
    const noteRow = await this.notesRepository.getDailyNote(date.unix());

    if (noteRow) {
      return {
        status: 'ok',
        data: await this.findNote(noteRow.id),
      } as ICreationResult<NoteModel>;
    }

    const title = date.format('D MMM YYYY');
    const startOfDate = date.startOf('day');

    return await this.createNote(
      {
        title,
        dailyNoteDate: startOfDate.toDate().getTime(),
      },
      { isDaily: true },
    );
  }

  getLinksOfNote$(noteId: string) {
    const links$ = from(
      this.dbEventsService.liveQuery(
        [VaultDbTables.Notes, VaultDbTables.NoteBlocks],
        () => this.notesBlocksRepository.getLinksOfNoteId(noteId),
        false,
      ),
    ).pipe(distinctUntilChanged((a, b) => isEqual(a, b)));

    return links$.pipe(
      switchMap((links) => {
        return this.findNoteByIds$(of(Object.keys(links))).pipe(
          map((notes) =>
            notes.map((note) => ({
              note,
              linkedBlockIds: links[note.$modelId],
            })),
          ),
        );
      }),
    );
  }

  getBlocksRegistryByNoteIds$(notesIds$: Observable<string[]>) {
    const notLoadedNotes$ = notesIds$.pipe(
      switchMap((notesIds) => {
        const notLoadedTreeRegistryIds = notesIds.filter(
          (id) => !this.vault.areBlocksOfNoteLoaded(id),
        );

        return notLoadedTreeRegistryIds.length > 0
          ? from(
              this.dbEventsService.liveQuery(
                [VaultDbTables.NoteBlocks],
                async () =>
                  (
                    await this.notesBlocksRepository.getByNoteIds(
                      notesIds.filter(
                        (id) => !this.vault.areBlocksOfNoteLoaded(id),
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
        this.vault.createOrUpdateEntitiesFromAttrs(
          [],
          unloadedBlocksAttrs,
          true,
        );
      }),
      switchMap(({ notesIds }) =>
        toObserver(() => {
          return notesIds.map((id) =>
            this.vault.noteBlocksApp.getBlocksRegistryByNoteId(id),
          );
        }),
      ),
      distinctUntilChanged((a, b) => isEqual(a, b)),
    );
  }

  getBlocksScope$(
    arg$: Observable<{
      noteId: string;
      scopedBy: { $modelId: string; $modelType: string };
      rootBlockViewId?: string;
    }>,
  ) {
    return this.getBlocksScopes$(arg$.pipe(map((arg) => [arg]))).pipe(
      map((scopes) => scopes[0]),
    );
  }

  getBlocksScopes$(
    args$: Observable<
      {
        noteId: string;
        scopedBy: { $modelId: string; $modelType: string };
        rootBlockViewId?: string;
      }[]
    >,
  ) {
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

              this.vault.createOrUpdateEntitiesFromAttrs(
                [],
                noteBlockAttrs,
                true,
              );

              return args;
            })(),
          );
        } else {
          return of(args);
        }
      }),
      map((args) => {
        // TODO: load collapsedBlockIds from DB
        return this.vault.noteBlocksApp.getOrCreateScopes(
          args.map((arg) => ({ ...arg, collapsedBlockIds: [] })),
        );
      }),
      distinctUntilChanged((a, b) => isEqual(a, b)),
    );
  }

  findNoteByIds$(ids$: Observable<string[]>) {
    return ids$.pipe(
      switchMap((ids) =>
        // TODO: load only not loaded
        this.dbEventsService.liveQuery([VaultDbTables.Notes], async () => {
          const toLoadIds = ids.filter(
            (id) => !Boolean(this.vault.notesMap[id]),
          );

          const noteDocs =
            toLoadIds.length !== 0
              ? await this.notesRepository.getByIds(toLoadIds)
              : [];

          this.vault.createOrUpdateEntitiesFromAttrs(
            noteDocs.map((doc) => convertNoteDocToModelAttrs(doc)),
            [],
            true,
          );

          return ids
            .map((id) => this.vault.notesMap[id])
            .filter((v) => Boolean(v));
        }),
      ),
      distinctUntilChanged((a, b) => isEqual(a, b)),
    );
  }

  async findNote(id: string) {
    if (this.vault.notesMap[id]) {
      return this.vault.notesMap[id];
    } else {
      const noteDoc = await this.notesRepository.getById(id);

      if (!noteDoc) {
        console.error(`Note with id ${id} not found`);

        return;
      }

      this.vault.createOrUpdateEntitiesFromAttrs(
        [convertNoteDocToModelAttrs(noteDoc)],
        [],
        false,
      );

      console.debug(`Loading Note#${id} from dexie`);

      return this.vault.notesMap[id];
    }
  }

  getNoteIdByTitle$(title: string) {
    return from(
      this.dbEventsService.liveQuery([VaultDbTables.Notes], () =>
        this.notesRepository.getByTitles([title]),
      ) as Observable<NoteDocType[]>,
    ).pipe(
      map((docs) => docs[0]?.id),
      distinctUntilChanged(),
    );
  }

  async updateNoteBlockLinks(noteBlockIds: string[]) {
    return Promise.all(
      noteBlockIds.map(async (id) => {
        const noteBlock = this.vault.getNoteBlock(id);

        if (!noteBlock) {
          console.error('noteBlock note found');
          return;
        }
        console.debug('Updating links');

        const titles = uniq([
          ...(
            filterAst(
              noteBlock.content.ast,
              (t) => t.type === 'ref',
            ) as RefToken[]
          ).map((t: RefToken) => t.ref),
          ...(
            filterAst(
              noteBlock.content.ast,
              (t) => t.type === 'tag',
            ) as TagToken[]
          ).map((t: TagToken) => t.ref),
        ]);

        const existingNotesIndexed = Object.fromEntries(
          (titles.length > 0
            ? await this.notesRepository.getByTitles(titles)
            : []
          ).map((n) => [n.title, n]),
        );

        const allParsedLinkedNotes = (
          await Promise.all(
            titles.map(async (name) => {
              if (!existingNotesIndexed[name]) {
                const result = await this.createNote(
                  { title: name },
                  { isDaily: false },
                );

                if (result.status === 'ok') {
                  return result.data;
                } else {
                  alert(JSON.stringify(result.errors));
                }
              } else {
                const existing = existingNotesIndexed[name];

                return this.findNote(existing.id);
              }
            }),
          )
        ).flatMap((n) => (n ? [n] : []));

        noteBlock.updateLinks(
          allParsedLinkedNotes.map(({ $modelId }) => $modelId),
        );
      }),
    );
  }

  // async preloadOrCreateBlocksViews(
  //   note: NoteModel,
  //   models: { $modelId: string; $modelType: string }[],
  // ) {
  //   const generateKey = (model: { $modelId: string; $modelType: string }) =>
  //     `${note.$modelId}-${model.$modelType}-${model.$modelId}`;
  //   const keys = models.map((model) => generateKey(model));

  //   const docs = await this.blocksViewsRepo.getByIds(keys);

  //   // this.vault.ui.createOrUpdateEntitiesFromAttrs(
  //   //   docs.map((doc) => convertViewToModelAttrs(doc)),
  //   // );

  //   // this.vault.ui.createBlockStateByModels(note, models);
  // }

  // async preloadOrCreateBlocksView(
  //   note: NoteModel,
  //   model: { $modelId: string; $modelType: string },
  // ) {
  //   const key = `${note.$modelId}-${model.$modelType}-${model.$modelId}`;

  //   const doc = await this.blocksViewsRepo.getById(key);

  //   // if (doc) {
  //   //   this.vault.ui.createOrUpdateEntitiesFromAttrs([
  //   //     convertViewToModelAttrs(doc),
  //   //   ]);
  //   // } else {
  //   //   this.vault.ui.createViewByModel(note, model);
  //   // }
  // }

  async isNoteExists(title: string) {
    if (Object.values(this.vault.notesMap).find((note) => note.title === title))
      return true;

    return !!(await this.notesRepository.findBy({title}));
  }

  // TODO: better Rx way, put title to pipe
  searchNotesTuples$(title: string) {
    return from(
      this.dbEventsService.liveQuery([VaultDbTables.Notes], () =>
        this.findService.findNote(title),
      ),
    ).pipe(
      map((rows) =>
        rows.map((row) => ({
          id: row.id,
          title: row.title,
        })),
      ),
    );
  }

  findNotesOrBlocks$(content: string) {
    return from(
      this.dbEventsService.liveQuery(
        [VaultDbTables.Notes, VaultDbTables.NoteBlocks],
        () => this.findService.find(content),
        false,
      ),
    );
  }
  getAllNotesTuples$() {
    return from(
      this.dbEventsService.liveQuery([VaultDbTables.Notes], () =>
        this.notesRepository.getAll(),
      ),
    ).pipe(
      map((rows) =>
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          createdAt: new Date(row.createdAt),
        })),
      ),
    );
  }

  async deleteNote(id: string) {
    await this.deleteNoteService.deleteNote(id);
  }

  async import(importData: {
    data: { data: { tableName: string; rows: any[] }[] };
  }) {
    await this.importExportService.importData(importData);
  }

  async export() {
    return await this.importExportService.exportData();
  }

  close = () => {
    console.debug(`Vault ${this.vault.$modelId} is closed`);

    this.stopSubject.next(null);
  };
}
