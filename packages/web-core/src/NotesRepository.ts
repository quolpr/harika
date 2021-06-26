import type { ModelCreationData } from 'mobx-keystone';
import type { Dayjs } from 'dayjs';
import type { NoteBlockModel } from './NotesRepository/models/NoteBlockModel';
import type { NoteModel } from './NotesRepository/models/NoteModel';
import type { Optional } from 'utility-types';
import type { Required } from 'utility-types';
import type { ICreationResult } from './NotesRepository/types';
import type { VaultModel } from './NotesRepository/models/VaultModel';
import type { VaultDexieDatabase } from './NotesRepository/dexieDb/DexieDb';
import { loadNoteDocToModelAttrs } from './NotesRepository/dexieDb/convertDocToModel';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { omitBy, uniq, uniqBy } from 'lodash-es';
import { filterAst } from './NotesRepository/models/NoteBlockModel/blockParser/astHelpers';
import type { RefToken } from './NotesRepository/models/NoteBlockModel/blockParser/types';
import { from, Observable } from 'rxjs';
import type { NoteDocType } from '@harika/common';
import { liveQuery } from 'dexie';
import { exportDB } from 'dexie-export-import';

export { NoteModel } from './NotesRepository/models/NoteModel';
export { VaultModel } from './NotesRepository/models/VaultModel';
export {
  NoteBlockModel,
  noteBlockRef,
} from './NotesRepository/models/NoteBlockModel';

// Document = Dexie doc
// Model = DDD model
// Tuple = plain object data, used for fast data getting

export class NotesRepository {
  constructor(private db: VaultDexieDatabase, public vault: VaultModel) {}

  initSync(wsUrl: string) {
    // new RxSyncer(
    //   this.db,
    //   'vault',
    //   this.db.id,
    //   `${wsUrl}/api/vault`,
    //   new ConflictsResolver(this.db),
    // );
  }

  async createNote(
    attrs: Required<
      Optional<
        ModelCreationData<NoteModel>,
        | 'createdAt'
        | 'dailyNoteDate'
        | 'rootBlockRef'
        | 'areLinksLoaded'
        | 'areBacklinksLoaded'
        | 'areChildrenLoaded'
      >,
      'title'
    >,
  ) {
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
      data: this.vault.newNote({
        ...attrs,
        areChildrenLoaded: true,
        areLinksLoaded: true,
        areBacklinksLoaded: true,
      }),
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

    return await this.createNote({
      title,
      dailyNoteDate: startOfDate.toDate().getTime(),
      areChildrenLoaded: true,
      areLinksLoaded: true,
      areBacklinksLoaded: true,
    });
  }

  async findNote(
    id: string,
    preloadChildren = true,
    preloadLinks = true,
    preloadBacklinks = true,
  ) {
    if (this.vault.notesMap[id]) {
      const noteInStore = this.vault.notesMap[id];

      if (
        !noteInStore.areNeededDataLoaded(
          preloadChildren,
          preloadLinks,
          preloadBacklinks,
        )
      ) {
        console.debug(`Loading Note#${id} from dexie`);

        return this.preloadNote(
          id,
          preloadChildren,
          preloadLinks,
          preloadBacklinks,
        );
      } else {
        console.debug(`Note${id} already loaded`);

        return noteInStore;
      }
    }

    return this.preloadNote(
      id,
      preloadChildren,
      preloadLinks,
      preloadBacklinks,
    );
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

  async updateNoteBlockLinks(noteBlock: NoteBlockModel) {
    return this.db.transaction(
      'r',
      this.db.notes,
      this.db.noteBlocks,
      async () => {
        console.debug('Updating links');

        const titles = uniq(
          (
            filterAst(
              noteBlock.content.ast,
              (t) => t.type === 'ref',
            ) as RefToken[]
          ).map((t: RefToken) => t.content),
        );

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
                const result = await this.createNote({ title: name });

                if (result.status === 'ok') {
                  return result.data;
                } else {
                  alert(JSON.stringify(result.errors));
                }
              } else {
                const existing = existingNotesIndexed[name];

                return this.findNote(existing.id, false, false, false);
              }
            }),
          )
        ).flatMap((n) => (n ? [n] : []));

        noteBlock.updateLinks(
          allParsedLinkedNotes.map(({ $modelId }) => $modelId),
        );
      },
    );
  }

  async preloadNote(
    id: string,
    preloadChildren: boolean,
    preloadLinks: boolean,
    preloadBacklinks: boolean,
  ) {
    const row = await this.db.notesQueries.getById(id);

    if (!row) return;

    const data = await loadNoteDocToModelAttrs(
      this.db,
      row,
      preloadChildren,
      preloadLinks,
      preloadBacklinks,
    );

    this.vault.createOrUpdateEntitiesFromAttrs(data.notes, data.noteBlocks);

    return this.vault.notesMap[row.id];
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
                linkedNoteIds: omitBy(
                  block.linkedNoteIdsMap,
                  (_val, key) => key === id,
                ),
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
          await this.db.table(tableName).bulkAdd(rows);
        }),
      );
    });
  }

  async export() {
    // Fails to compile on build time, so I put any here
    return exportDB(this.db as any, {
      filter: (t) => ['notes', 'noteBlocks'].includes(t),
    });
  }

  close = () => {
    console.debug(`Vault ${this.vault.$modelId} is closed`);

    this.db.close();
  };
}
