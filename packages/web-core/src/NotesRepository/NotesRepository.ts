import type { ModelCreationData } from 'mobx-keystone';
import type { Dayjs } from 'dayjs';
import type { NoteModel } from './domain/NoteModel';
import type { Optional } from 'utility-types';
import type { Required } from 'utility-types';
import type { ICreationResult } from './types';
import type { VaultModel } from './domain/VaultModel';
import type { VaultDexieDatabase } from './persistence/DexieDb';
import { distinctUntilChanged, map, switchMap, take } from 'rxjs/operators';
import { uniq, uniqBy } from 'lodash-es';
import { filterAst } from '../blockParser/astHelpers';
import type { RefToken, TagToken } from '../blockParser/types';
import { firstValueFrom, from, Observable, Subject } from 'rxjs';
import { BlocksViewDocType, NoteDocType, VaultDbTables } from '../dexieTypes';
import { liveQuery } from 'dexie';
import { exportDB } from 'dexie-export-import';
import {
  convertNoteBlockDocToModelAttrs,
  convertNoteDocToModelAttrs,
  convertViewToModelAttrs,
} from './syncers/toDomainModelsConverters';
import type { ITransmittedChange } from '../dexie-sync/changesChannel';
import { NotesChangesTrackerService } from './services/notes-tree/NotesChangesTrackerService';
import dayjs from 'dayjs';

export { NoteModel } from './domain/NoteModel';
export { VaultModel } from './domain/VaultModel';
export { NoteBlockModel, noteBlockRef } from './domain/NoteBlockModel';

// Document = Dexie doc
// Model = DDD model
// Tuple = plain object data, used for fast data getting

export class NotesRepository {
  private stopSubject = new Subject<unknown>();
  private stop$ = this.stopSubject.pipe(take(1));

  constructor(
    private db: VaultDexieDatabase,
    public vault: VaultModel,
    private globalChanges$: Observable<ITransmittedChange[]>,
  ) {}

  async initialize() {
    new NotesChangesTrackerService(
      this.globalChanges$,
      this.vault.notesTree,
      this.stop$,
    );

    this.vault.initializeNotesTree(
      (await this.db.notes.toArray())
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
      await this.getBlocksTreeHolderByNoteIds(
        (
          await firstValueFrom(this.getLinkedNotes$(noteId))
        ).map(({ $modelId }) => $modelId),
      )
    )
      .flatMap((holder) => holder.getLinkedBlocksOfNoteId(noteId))
      .map((block) => block.content.updateTitle(oldTitle, newTitle));

    note.updateTitle(newTitle);

    return 'ok';
  }

  async createNote(
    attrs: Required<
      Optional<ModelCreationData<NoteModel>, 'createdAt' | 'dailyNoteDate'>,
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

    if (await this.db.notesQueries.getIsNoteExists(attrs.title)) {
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

  async getOrCreateDailyNote(this: NotesRepository, date: Dayjs) {
    const noteRow = await this.db.notesQueries.getDailyNote(date);

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
    return from(
      liveQuery(() =>
        this.db.notesQueries.getLinkedNoteIdsOfNoteId(noteId),
      ) as Observable<string[]>,
    ).pipe(
      switchMap(
        (ids) =>
          liveQuery(() => this.findNoteByIds(ids)) as Observable<NoteModel[]>,
      ),
    );
  }

  async getBlocksTreeHolderByNoteIds(notesIds: string[]) {
    const toLoadNoteIds = notesIds.filter(
      (id) => this.vault.blocksTreeHoldersMap[id] === undefined,
    );

    const blocksAttrs = (
      await this.db.noteBlocksQueries.getByNoteIds(toLoadNoteIds)
    ).map((m) => convertNoteBlockDocToModelAttrs(m));

    this.vault.createOrUpdateEntitiesFromAttrs([], blocksAttrs);

    return notesIds.map((noteId) => this.vault.blocksTreeHoldersMap[noteId]);
  }

  async getBlocksTreeHolder(noteId: string) {
    if (!this.vault.blocksTreeHoldersMap[noteId]) {
      const noteBlockAttrs = await Promise.all(
        (
          await this.db.noteBlocksQueries.getByNoteId(noteId)
        ).map((m) => convertNoteBlockDocToModelAttrs(m)),
      );

      this.vault.createOrUpdateEntitiesFromAttrs([], noteBlockAttrs);
    }

    return this.vault.blocksTreeHoldersMap[noteId];
  }

  async findNoteByIds(ids: string[]) {
    const noteDocs = await this.db.notesQueries.getByIds(ids);

    this.vault.createOrUpdateEntitiesFromAttrs(
      noteDocs.map((doc) => convertNoteDocToModelAttrs(doc)),
      [],
    );

    return ids.map((id) => this.vault.notesMap[id]).filter((v) => Boolean(v));
  }

  async findNote(id: string) {
    if (this.vault.notesMap[id]) {
      return this.vault.notesMap[id];
    } else {
      const noteDoc = await this.db.notes.get(id);

      if (!noteDoc) {
        console.error(`Note with id ${id} not found`);

        return;
      }

      this.vault.createOrUpdateEntitiesFromAttrs(
        [convertNoteDocToModelAttrs(noteDoc)],
        [],
      );

      console.debug(`Loading Note#${id} from dexie`);

      return this.vault.notesMap[id];
    }
  }

  getNoteIdByTitle$(title: string) {
    return from(
      liveQuery(() => this.db.notesQueries.getByTitles([title])) as Observable<
        NoteDocType[]
      >,
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
          (await this.db.notesQueries.getByTitles(titles)).map((n) => [
            n.title,
            n,
          ]),
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

    const docs = (await this.db.blocksViews.bulkGet(keys)).filter((v) =>
      Boolean(v),
    ) as BlocksViewDocType[];

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

    const doc = await this.db.blocksViews.get(key);

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

    if (await this.db.notes.get({ title })) return true;

    return false;
  }

  // TODO: better Rx way, put title to pipe
  searchNotesTuples$(title: string) {
    return from(
      liveQuery(() => this.db.notesQueries.searchNotes(title)) as Observable<
        NoteDocType[]
      >,
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
      liveQuery(() => this.db.notesQueries.all()) as Observable<NoteDocType[]>,
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
    return this.db.transaction(
      'rw',
      [this.db.noteBlocks, this.db.notes],
      async () => {
        let [linkedBlocks, blocks, note] = await Promise.all([
          this.db.noteBlocksQueries.getLinkedBlocksOfNoteId(id),
          this.db.noteBlocksQueries.getByNoteId(id),
          this.db.notesQueries.getById(id),
        ]);

        const noteBlockIds = blocks.map(({ id }) => id);
        linkedBlocks = uniqBy(linkedBlocks, ({ id }) => id).filter(
          // cause they will be already removed
          ({ id }) => !noteBlockIds.includes(id),
        );

        if (!note) {
          console.error(`Note with id ${id} not deleted - not found`);

          return;
        }

        await Promise.all([
          await this.db.notes.delete(note.id),
          await this.db.noteBlocks.bulkDelete(noteBlockIds),
          await Promise.all(
            linkedBlocks.map(async (block) => {
              await this.db.noteBlocks.update(block.id, {
                linkedNoteIds: block.linkedNoteIds.filter((key) => key !== id),
              });
            }),
          ),
        ]);
      },
    );
  }

  async import(importData: {
    data: { data: { tableName: string; rows: any[] }[] };
  }) {
    const data = importData.data.data.filter(
      ({ tableName }) => tableName[0] !== '_',
    );
    const tables = data.map(({ tableName }) => tableName);

    return this.db.transaction('rw', tables, async () => {
      return Promise.all(
        data.map(async ({ tableName, rows }) => {
          await this.db
            .table(tableName)
            .bulkAdd(rows.filter(({ id }) => Boolean(id))); // some rows could be broken, we check that at least id present
        }),
      );
    });
  }

  async export() {
    // Fails to compile on build time, so I put any here
    return exportDB(this.db as any, {
      filter: (t) =>
        [
          VaultDbTables.Notes,
          VaultDbTables.NoteBlocks,
          VaultDbTables.BlocksViews,
        ].includes(t as VaultDbTables),
    });
  }

  close = () => {
    console.debug(`Vault ${this.vault.$modelId} is closed`);

    this.stopSubject.next(null);
    this.db.close();
  };
}
