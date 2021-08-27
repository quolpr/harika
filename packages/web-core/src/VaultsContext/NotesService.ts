/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ModelCreationData } from 'mobx-keystone';
import type { Dayjs } from 'dayjs';
import type { NoteModel } from './domain/NoteModel';
import type { Optional } from 'utility-types';
import type { Required } from 'utility-types';
import type { ICreationResult } from './types';
import type { VaultModel } from './domain/VaultModel';
import {
  distinctUntilChanged,
  map,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';
import { omit, uniq } from 'lodash-es';
import { filterAst } from '../blockParser/astHelpers';
import type { RefToken, TagToken } from '../blockParser/types';
import { firstValueFrom, from, Observable, of, Subject } from 'rxjs';
import {
  BlocksViewDocType,
  NoteBlockDocType,
  NoteDocType,
  VaultDbTables,
} from '../dexieTypes';
import {
  convertNoteBlockDocToModelAttrs,
  convertNoteDocToModelAttrs,
  convertViewToModelAttrs,
} from './syncers/toDomainModelsConverters';
import { NotesChangesTrackerService } from './services/notes-tree/NotesChangesTrackerService';
import dayjs from 'dayjs';
import { toObserver } from '../toObserver';
import type {
  SqlNotesBlocksRepository,
  SqlNotesRepository,
} from '../SqlNotesRepository.worker';
import type { Remote } from 'comlink';
import type { DbEventsService } from '../DbEventsService';

export { NoteModel } from './domain/NoteModel';
export { VaultModel } from './domain/VaultModel';
export { NoteBlockModel, noteBlockRef } from './domain/NoteBlockModel';

// Document = Dexie doc
// Model = DDD model
// Tuple = plain object data, used for fast data getting

export class NotesService {
  private stopSubject = new Subject<unknown>();
  private stop$ = this.stopSubject.pipe(take(1));

  constructor(
    private notesRepository: Remote<SqlNotesRepository>,
    private notesBlocksRepository: Remote<SqlNotesBlocksRepository>,
    private dbEventsService: DbEventsService,
    public vault: VaultModel,
  ) {}

  async initialize() {
    new NotesChangesTrackerService(
      this.dbEventsService.changesChannel$(),
      this.vault.notesTree,
      this.stop$,
    );

    this.vault.initializeNotesTree(
      (await this.notesRepository.getAll())
        .filter(
          ({ dailyNoteDate, title }) =>
            !dailyNoteDate ||
            // TODO: remove this hack. Only !dailyNoteDate check will be needed
            (dailyNoteDate &&
              dayjs(dailyNoteDate).format('D MMM YYYY') !== title),
        )

        .map(({ id, title }) => ({
          id,
          title,
        })),
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
        this.getBlocksTreeHolderByNoteIds$(
          this.getLinkedNotes$(noteId).pipe(
            map((models) => models.map(({ $modelId }) => $modelId)),
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
        'createdAt' | 'updatedAt' | 'dailyNoteDate'
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

  getLinkedNotes$(noteId: string) {
    const noteIds$ = from(
      this.dbEventsService.liveQuery([VaultDbTables.Notes], () =>
        this.notesBlocksRepository.getLinkedNoteIdsOfNoteId(noteId),
      ),
    );

    return this.findNoteByIds$(noteIds$);
  }

  getBlocksTreeHolderByNoteIds$(notesIds$: Observable<string[]>) {
    const notLoadedNotes$ = notesIds$.pipe(
      switchMap((notesIds) =>
        from(
          this.dbEventsService.liveQuery([VaultDbTables.NoteBlocks], async () =>
            (
              await this.notesBlocksRepository.getByNoteIds(
                notesIds.filter(
                  (id) => this.vault.blocksTreeHoldersMap[id] === undefined,
                ),
              )
            ).map((m) => convertNoteBlockDocToModelAttrs(m)),
          ),
        ).pipe(map((attrs) => ({ unloadedBlocksAttrs: attrs, notesIds }))),
      ),
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
          return notesIds.map((id) => this.vault.blocksTreeHoldersMap[id]);
        }),
      ),
    );
  }

  getBlocksTreeHolder$(noteId$: Observable<string>) {
    return noteId$.pipe(
      map((noteId) => ({
        noteId,
        holder: this.vault.blocksTreeHoldersMap[noteId],
      })),
      switchMap(({ holder, noteId }) => {
        if (!holder) {
          return this.dbEventsService.liveQuery(
            [VaultDbTables.NoteBlocks],
            async () => {
              const noteBlockAttrs = await Promise.all(
                (
                  await this.notesBlocksRepository.getByNoteId(noteId)
                ).map((m) => convertNoteBlockDocToModelAttrs(m)),
              );

              this.vault.createOrUpdateEntitiesFromAttrs(
                [],
                noteBlockAttrs,
                true,
              );

              return noteId;
            },
          );
        } else {
          return of(noteId);
        }
      }),
      switchMap((noteId) =>
        toObserver(() => this.vault.blocksTreeHoldersMap[noteId]),
      ),
    );
  }

  findNoteByIds$(ids$: Observable<string[]>) {
    return ids$.pipe(
      switchMap((ids) =>
        this.dbEventsService.liveQuery([VaultDbTables.Notes], async () => {
          const noteDocs =
            ids.length !== 0 ? await this.notesRepository.getByIds(ids) : [];

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

  async preloadOrCreateBlocksViews(
    note: NoteModel,
    models: { $modelId: string; $modelType: string }[],
  ) {
    const generateKey = (model: { $modelId: string; $modelType: string }) =>
      `${note.$modelId}-${model.$modelType}-${model.$modelId}`;
    const keys = models.map((model) => generateKey(model));

    // const docs = (await this.db.blocksViews.bulkGet(keys)).filter((v) =>
    //   Boolean(v),
    // ) as BlocksViewDocType[];

    const docs: BlocksViewDocType[] = [];

    this.vault.ui.createOrUpdateEntitiesFromAttrs(
      docs.map((doc) => convertViewToModelAttrs(doc)),
    );

    this.vault.ui.createViewsByModels(note, models);
  }

  async preloadOrCreateBlocksView(
    note: NoteModel,
    model: { $modelId: string; $modelType: string },
  ) {
    const key = `${note.$modelId}-${model.$modelType}-${model.$modelId}`;

    // const doc = await this.db.blocksViews.get(key);
    const doc = undefined;

    if (doc) {
      this.vault.ui.createOrUpdateEntitiesFromAttrs([
        convertViewToModelAttrs(doc),
      ]);
    } else {
      this.vault.ui.createViewByModel(note, model);
    }
  }

  async isNoteExists(title: string) {
    if (Object.values(this.vault.notesMap).find((note) => note.title === title))
      return true;

    if (await this.notesRepository.findBy({ title })) return true;

    return false;
  }

  // TODO: better Rx way, put title to pipe
  searchNotesTuples$(title: string) {
    return from(
      this.dbEventsService.liveQuery([VaultDbTables.Notes], () =>
        this.notesRepository.findInTitle(title),
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
    // return this.db.transaction(
    //   'rw',
    //   [this.db.noteBlocks, this.db.notes],
    //   async () => {
    //     let [linkedBlocks, blocks, note] = await Promise.all([
    //       this.db.noteBlocksQueries.getLinkedBlocksOfNoteId(id),
    //       this.db.noteBlocksQueries.getByNoteId(id),
    //       this.db.notesQueries.getById(id),
    //     ]);
    //     const noteBlockIds = blocks.map(({ id }) => id);
    //     linkedBlocks = uniqBy(linkedBlocks, ({ id }) => id).filter(
    //       // cause they will be already removed
    //       ({ id }) => !noteBlockIds.includes(id),
    //     );
    //     if (!note) {
    //       console.error(`Note with id ${id} not deleted - not found`);
    //       return;
    //     }
    //     await Promise.all([
    //       await this.db.notes.delete(note.id),
    //       await this.db.noteBlocks.bulkDelete(noteBlockIds),
    //       await Promise.all(
    //         linkedBlocks.map(async (block) => {
    //           await this.db.noteBlocks.update(block.id, {
    //             linkedNoteIds: block.linkedNoteIds.filter((key) => key !== id),
    //           });
    //         }),
    //       ),
    //     ]);
    //   },
    // );
  }

  async import(importData: {
    data: { data: { tableName: string; rows: any[] }[] };
  }) {
    const data = importData.data.data.filter(
      ({ tableName }) => tableName[0] !== '_',
    );
    const tables = data.map(({ tableName }) => tableName);

    // TODO: in one transaction
    await Promise.all(
      importData.data.data.map(async ({ rows, tableName }) => {
        if (tableName === 'notes') {
          await this.notesRepository.bulkCreate(
            rows
              .filter(({ title }) => title !== undefined)
              .map(
                (row) =>
                  omit(
                    {
                      ...row,
                      updatedAt: row.updatedAt || new Date().getTime(),
                    },
                    ['rootBlockId', '$types'],
                  ) as NoteDocType,
              ),
            {
              shouldRecordChange: true,
              source: 'inDbChanges',
            },
          );
        } else if (tableName === 'noteBlocks') {
          await this.notesBlocksRepository.bulkCreate(
            rows
              .filter((row) => Boolean(row.noteId))
              .map(
                (row) =>
                  omit(
                    {
                      ...row,
                      updatedAt: row.updatedAt || new Date().getTime(),
                      linkedNoteIds: row.linkedNoteIds.filter(
                        (v: string | null) => Boolean(v),
                      ),
                      noteBlockIds: row.noteBlockIds.filter(
                        (v: string | null) => Boolean(v),
                      ),
                    },
                    ['parentBlockId'],
                  ) as NoteBlockDocType,
              ),
            {
              shouldRecordChange: true,
              source: 'inDbChanges',
            },
          );
        }
      }),
    );
    // const rootBlockIds = data
    //   .find(({ tableName }) => tableName === 'notes')
    //   ?.rows.map(({ rootBlockId }) => rootBlockId)
    //   .filter((id) => Boolean(id)) as string[];

    // await Promise.all(
    //   rootBlockIds.map((id) => this.db.noteBlocks.update(id, { isRoot: 1 })),
    // );
  }

  async export() {
    // Fails to compile on build time, so I put any here
    // return exportDB(this.db as any, {
    //   filter: (t) =>
    //     [
    //       VaultDbTables.Notes,
    //       VaultDbTables.NoteBlocks,
    //       VaultDbTables.BlocksViews,
    //     ].includes(t as VaultDbTables),
    // });
  }

  close = () => {
    console.debug(`Vault ${this.vault.$modelId} is closed`);

    this.stopSubject.next(null);
  };
}
