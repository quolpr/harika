/* eslint-disable @typescript-eslint/no-unused-vars */
import { ModelCreationData, withoutUndo } from 'mobx-keystone';
import type { Dayjs } from 'dayjs';
import type { NoteModel } from './NotesApp/models/NoteModel';
import type { Optional } from 'utility-types';
import type { Required } from 'utility-types';
import type { ICreationResult } from './types';
import type { Vault } from './Vault';
import {
  distinctUntilChanged,
  first,
  map,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { isEqual, uniq } from 'lodash-es';
import { filterAst } from '../../lib/blockParser/astHelpers';
import type {
  NoteBlockRef,
  NoteRefToken,
  TagToken,
} from '../../lib/blockParser/types';
import {
  BehaviorSubject,
  firstValueFrom,
  from,
  interval,
  Observable,
  of,
  Subject,
} from 'rxjs';
import { convertNoteDocToModelAttrs } from './NotesApp/converters/toModels';
import { NotesChangesTrackerService } from './NotesTreeApp/services/NotesChangesTrackerService';
import { toObserver } from '../../lib/toObserver';
import type { Remote } from 'comlink';
import type { DbEventsListenService } from '../../extensions/SyncExtension/services/DbEventsListenerService';
import {
  noteBlocksTable,
  NotesBlocksRepository,
} from '../../newApps/VaultApplication/NoteBlocksExtension/repositories/NotesBlocksRepository';
import {
  SqlNotesRepository,
  notesTable,
} from './NotesApp/repositories/NotesRepository';
import type { NoteDoc } from './NotesApp/repositories/NotesRepository';
import type { BlocksScopesRepository } from '../../newApps/VaultApplication/NoteBlocksExtension/repositories/BlockScopesRepository';
import type { FindNoteOrBlockService } from './services/FindNoteOrBlockService';
import type { ImportExportService } from './services/ImportExportService';
import type { DeleteNoteService } from './NotesApp/services/DeleteNoteService';
import { getScopeKey } from '../../newApps/VaultApplication/NoteBlocksExtension/models/NoteBlocksExtensionStore';
import {
  defaultSyncState,
  initSync,
  ISyncState,
} from '../../extensions/SyncExtension/synchronizer/init';
import { VaultAppDbWorker } from './VaultAppDb.worker';
import dayjs from 'dayjs';
import { withoutSync } from './utils/syncable';
import { ToDbSyncer } from './syncers/ToDbSyncer';
import { convertNoteBlockDocToModelAttrs } from '../../newApps/VaultApplication/NoteBlocksExtension/converters/toModels';

export { NoteModel } from './NotesApp/models/NoteModel';
export { Vault } from './Vault';
export {
  NoteBlockModel,
  noteBlockRef,
} from '../../newApps/VaultApplication/NoteBlocksExtension/models/NoteBlockModel';

export class VaultApp {
  private stopSubject = new Subject<unknown>();
  private stop$ = this.stopSubject.pipe(take(1));

  syncState$ = new BehaviorSubject<ISyncState>(defaultSyncState);
  isSyncServerConnectionAllowed$ = new BehaviorSubject<boolean>(true);
  isDbHealthOk$ = new BehaviorSubject<boolean>(true);

  constructor(
    private notesRepository: Remote<SqlNotesRepository>,
    private notesBlocksRepository: Remote<NotesBlocksRepository>,
    private blocksScopesRepo: Remote<BlocksScopesRepository>,
    private dbEventsService: DbEventsListenService,
    private importExportService: Remote<ImportExportService>,
    private deleteNoteService: Remote<DeleteNoteService>,
    private findService: Remote<FindNoteOrBlockService>,
    public vault: Vault,
  ) {
    new ToDbSyncer(
      notesRepository,
      notesBlocksRepository,
      blocksScopesRepo,
      this.stop$,
    );
  }

  async initSync(
    dbName: string,
    worker: Remote<VaultAppDbWorker>,
    wsUrl: string,
    authToken: string,
  ) {
    const { syncState$ } = await initSync(
      dbName,
      worker,
      wsUrl,
      authToken,
      this.dbEventsService,
      this.isSyncServerConnectionAllowed$,
    );

    interval(5000)
      .pipe(
        switchMap(async () => {
          try {
            return worker.isHealthOk();
          } catch {
            return false;
          }
        }),
        takeUntil(this.stop$),
      )
      .subscribe((isOk) => {
        this.isDbHealthOk$.next(isOk);
      });

    syncState$.subscribe((val) => this.syncState$.next(val));
  }

  async initialize() {
    new NotesChangesTrackerService(
      this.dbEventsService.changesChannel$(),
      this.vault.notesTree,
      this.stop$,
    );

    // Don't freeze the startup
    setTimeout(async () => {
      this.vault.initializeNotesTree(
        await this.notesRepository.getTuplesWithoutDailyNotes(),
      );
    }, 200);
  }

  async updateNoteTitle(noteId: string, newTitle: string) {
    const exists = await this.isNoteExists(newTitle);

    if (exists) return 'exists' as const;

    const note = await this.getNote(noteId);

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

  getTodayDailyNote$() {
    return interval(1000).pipe(
      map(() => dayjs().startOf('day')),
      distinctUntilChanged((a, b) => a.unix() === b.unix()),
      switchMap((date) => this.getDailyNote$(date)),
      distinctUntilChanged(),
    );
  }

  getDailyNote$(date: Dayjs) {
    return from(
      this.dbEventsService.liveQuery([notesTable], () =>
        this.notesRepository.getDailyNote(date.unix()),
      ),
    ).pipe(switchMap((row) => (row ? this.getNote(row.id) : of(undefined))));
  }

  async getOrCreateDailyNote(this: VaultApp, date: Dayjs) {
    const noteRow = await this.notesRepository.getDailyNote(date.unix());

    if (noteRow) {
      return {
        status: 'ok',
        data: await this.getNote(noteRow.id),
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
        [notesTable, noteBlocksTable],
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

  findNoteByIds$(ids$: Observable<string[]>) {
    return ids$.pipe(
      switchMap((ids) =>
        // TODO: load only not loaded
        this.dbEventsService.liveQuery([notesTable], async () => {
          const toLoadIds = ids.filter(
            (id) => !Boolean(this.vault.notesMap[id]),
          );

          const noteDocs =
            toLoadIds.length !== 0
              ? await this.notesRepository.getByIds(toLoadIds)
              : [];

          withoutUndo(() => {
            this.vault.createOrUpdateEntitiesFromAttrs(
              noteDocs.map((doc) => convertNoteDocToModelAttrs(doc)),
              [],
              true,
            );
          });

          return ids
            .map((id) => this.vault.notesMap[id])
            .filter((v) => Boolean(v));
        }),
      ),
      distinctUntilChanged((a, b) => isEqual(a, b)),
    );
  }

  getNote$(id: string) {
    return from(
      this.dbEventsService.liveQuery([notesTable], () => this.getNote(id)),
    );
  }

  async getNote(id: string) {
    if (this.vault.notesMap[id]) {
      return this.vault.notesMap[id];
    } else {
      const noteDoc = await this.notesRepository.getById(id);

      if (!noteDoc) {
        console.error(`Note with id ${id} not found`);

        return;
      }

      withoutUndo(() => {
        this.vault.createOrUpdateEntitiesFromAttrs(
          [convertNoteDocToModelAttrs(noteDoc)],
          [],
          false,
        );
      });

      console.debug(`Loading Note#${id} from DB`);

      return this.vault.notesMap[id];
    }
  }

  getNoteIdByTitle$(title: string) {
    return from(
      this.dbEventsService.liveQuery([notesTable], () =>
        this.notesRepository.getByTitles([title]),
      ) as Observable<NoteDoc[]>,
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
        console.debug('Updating block note links');

        const titles = uniq(
          (
            filterAst(
              noteBlock.content.ast,
              (t) => t.type === 'noteRef' || t.type === 'tag',
            ) as (NoteRefToken | TagToken)[]
          ).map((t: NoteRefToken | TagToken) => t.ref),
        );

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

                return this.getNote(existing.id);
              }
            }),
          )
        ).flatMap((n) => (n ? [n] : []));

        noteBlock.updateNoteLinks(
          allParsedLinkedNotes.map(({ $modelId }) => $modelId),
        );
      }),
    );
  }

  async updateBlockBlockLinks(noteBlockIds: string[]) {
    return Promise.all(
      noteBlockIds.map(async (id) => {
        const noteBlock = this.vault.getNoteBlock(id);

        if (!noteBlock) {
          console.error('noteBlock note found');
          return;
        }

        console.debug('Updating block block links');

        noteBlock.updateBlockLinks(
          uniq(
            (
              filterAst(
                noteBlock.content.ast,
                (t) => t.type === 'noteBlockRef',
              ) as NoteBlockRef[]
            )
              .map((t) => t.blockId)
              .filter((id) => !!id) as string[],
          ),
        );
      }),
    );
  }

  async isNoteExists(title: string) {
    if (Object.values(this.vault.notesMap).find((note) => note.title === title))
      return true;

    return !!(await this.notesRepository.findBy({ title }));
  }

  searchNotesTuples$(title: string) {
    return from(
      this.dbEventsService.liveQuery([notesTable], () =>
        this.findService.findNotes(title),
      ),
    );
  }

  searchBlocksTuples$(title: string) {
    return from(
      this.dbEventsService.liveQuery([noteBlocksTable], () =>
        this.findService.findBlocks(title),
      ),
    );
  }

  findNotesOrBlocks$(content: string) {
    return from(
      this.dbEventsService.liveQuery(
        [notesTable, noteBlocksTable],
        () => this.findService.find(content),
        false,
      ),
    );
  }
  getAllNotesTuples$() {
    return from(
      this.dbEventsService.liveQuery([notesTable], () =>
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
