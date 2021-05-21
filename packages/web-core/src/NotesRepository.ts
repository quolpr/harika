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
import { liveSwitch } from './dexieHelpers/onDexieChange';
import { filterAst } from './blockParser/astHelpers';
import type { RefToken } from './blockParser/types';
import { map } from 'lodash-es';
import { distinctUntilChanged, switchMap } from 'rxjs/operators';

export { NoteModel } from './NotesRepository/models/NoteModel';
export { VaultModel } from './NotesRepository/models/VaultModel';
export { BlocksViewModel } from './NotesRepository/models/BlocksViewModel';
export {
  NoteBlockModel,
  noteBlockRef,
} from './NotesRepository/models/NoteBlockModel';
export { BlockContentModel } from './NotesRepository/models/BlockContentModel';

// Document = RxDb doc
// Model = DDD model
// Tuple = plain object data, used for fast data getting

export class NotesRepository {
  constructor(private vaultDexieDbs: Record<string, VaultDexieDatabase>) {}

  async createNote(
    vault: VaultModel,
    attrs: Required<
      Optional<
        ModelCreationData<NoteModel>,
        'createdAt' | 'dailyNoteDate' | 'rootBlockRef'
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

    if (
      await this.getDbByVaultId(vault.$modelId).notesQueries.getIsNoteExists(
        attrs.title,
      )
    ) {
      return {
        status: 'error',
        errors: { title: ['Already exists'] },
      } as ICreationResult<NoteModel>;
    }

    return {
      status: 'ok',
      data: vault.newNote(attrs),
    } as ICreationResult<NoteModel>;
  }

  async getOrCreateDailyNote(
    this: NotesRepository,
    vault: VaultModel,
    date: Dayjs,
  ) {
    const noteRow = await this.getDbByVaultId(
      vault.$modelId,
    ).notesQueries.getDailyNote(date);

    if (noteRow) {
      return {
        status: 'ok',
        data: await this.findNote(vault, noteRow.id),
      } as ICreationResult<NoteModel>;
    }

    const title = date.format('D MMM YYYY');
    const startOfDate = date.startOf('day');

    return await this.createNote(vault, {
      title,
      dailyNoteDate: startOfDate.toDate().getTime(),
    });
  }

  async findNote(
    vault: VaultModel,
    id: string,
    preloadChildren = true,
    preloadLinks = true,
  ) {
    if (vault.notesMap[id]) {
      const noteInStore = vault.notesMap[id];

      if (
        !(preloadChildren && !noteInStore.areChildrenLoaded) &&
        !(preloadLinks && !noteInStore.areLinksLoaded)
      )
        return noteInStore;
    }

    return this.preloadNote(vault, id, preloadChildren, preloadLinks);
  }

  getNoteIdByTitle$(vault: VaultModel, title: string) {
    const db = this.getDbByVaultId(vault.$modelId);

    return db.notesChange$.pipe(
      liveSwitch(async () => {
        return (await db.notesQueries.getByTitles([title]))[0]?.id;
      }),
      distinctUntilChanged(),
    );
  }

  async updateNoteBlockLinks(vault: VaultModel, noteBlock: NoteBlockModel) {
    return this.getDbByVaultId(vault.$modelId).transaction(
      'r',

      this.getDbByVaultId(vault.$modelId).notes,
      this.getDbByVaultId(vault.$modelId).noteBlocks,

      async () => {
        console.log('updating links');

        const titles = (
          filterAst(
            noteBlock.content.ast,
            (t) => t.type === 'ref',
          ) as RefToken[]
        ).map((t: RefToken) => t.content);

        const existingNotesIndexed = Object.fromEntries(
          (
            await this.getDbByVaultId(vault.$modelId).notesQueries.getByTitles(
              titles,
            )
          ).map((n) => [n.title, n]),
        );

        const allNotes = (
          await Promise.all(
            titles.map(async (name) => {
              if (!existingNotesIndexed[name]) {
                const result = await this.createNote(vault, { title: name });

                if (result.status === 'ok') {
                  return result.data;
                } else {
                  alert(JSON.stringify(result.errors));
                }
              } else {
                const existing = existingNotesIndexed[name];

                return this.findNote(vault, existing.id, false, false);
              }
            }),
          )
        ).flatMap((n) => (n ? [n] : []));

        const allNotesIndexed = Object.fromEntries(
          allNotes.map((n) => [n.$modelId, n]),
        );

        const existingLinkedNotesIndexed = Object.fromEntries(
          noteBlock.linkedNoteRefs.map((ref) => [ref.id, ref.current]),
        );

        allNotes.forEach((note) => {
          if (!existingLinkedNotesIndexed[note.$modelId]) {
            vault.createLink(note, noteBlock);
          }
        });

        Object.values(existingLinkedNotesIndexed).forEach((note) => {
          if (!allNotesIndexed[note.$modelId]) {
            vault.unlink(note, noteBlock);
          }
        });
      },
    );
  }

  async preloadNote(
    vault: VaultModel,
    id: string,
    preloadChildren = true,
    preloadLinks = true,
  ) {
    const row = await this.getDbByVaultId(vault.$modelId).notesQueries.getById(
      id,
    );

    if (!row) return;

    const data = await loadNoteDocToModelAttrs(
      this.getDbByVaultId(vault.$modelId),
      row,
      preloadChildren,
      preloadLinks,
    );

    vault.createOrUpdateEntitiesFromAttrs(
      [data.note, ...data.linkedNotes.map(({ note }) => note)],
      [
        ...data.noteBlocks,
        ...data.linkedNotes.flatMap(({ noteBlocks }) => noteBlocks),
      ],
    );

    return vault.notesMap[row.id];
  }

  // TODO: better Rx way, put title to pipe
  searchNotesTuples$(vaultId: string, title: string) {
    return this.getDbByVaultId(vaultId).notesChange$.pipe(
      liveSwitch(async () =>
        (
          await this.getDbByVaultId(vaultId).notesQueries.searchNotes(title)
        ).map((row) => ({
          id: row.id,
          title: row.title,
        })),
      ),
    );
  }

  getAllNotesTuples$(vaultId: string) {
    return this.getDbByVaultId(vaultId).notesChange$.pipe(
      liveSwitch(async () =>
        (await this.getDbByVaultId(vaultId).notesQueries.all()).map((row) => ({
          id: row.id,
          title: row.title,
          createdAt: new Date(row.createdAt),
        })),
      ),
    );
  }

  private getDbByVaultId(vaultId: string) {
    if (!this.vaultDexieDbs[vaultId])
      throw new Error('NotesRepository vaultDb was not initialized!');

    return this.vaultDexieDbs[vaultId];
  }
}
