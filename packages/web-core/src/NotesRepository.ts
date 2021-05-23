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
import { distinctUntilChanged } from 'rxjs/operators';
import { RxSyncer } from './dexieHelpers/RxSyncer';
import { ConflictsResolver } from './NotesRepository/dexieDb/ConflictsResolver';
import { uniqBy } from 'lodash-es';

export { NoteModel } from './NotesRepository/models/NoteModel';
export { VaultModel } from './NotesRepository/models/VaultModel';
export { BlocksViewModel } from './NotesRepository/models/BlocksViewModel';
export {
  NoteBlockModel,
  noteBlockRef,
} from './NotesRepository/models/NoteBlockModel';
export { BlockContentModel } from './NotesRepository/models/BlockContentModel';

// Document = Dexie doc
// Model = DDD model
// Tuple = plain object data, used for fast data getting

export class NotesRepository {
  constructor(private db: VaultDexieDatabase, public vault: VaultModel) {}

  initSync(wsUrl: string) {
    new RxSyncer(
      this.db,
      'vault',
      this.db.id,
      `${wsUrl}/api/vault`,
      new ConflictsResolver(this.db),
    );
  }

  async createNote(
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

    if (await this.db.notesQueries.getIsNoteExists(attrs.title)) {
      return {
        status: 'error',
        errors: { title: ['Already exists'] },
      } as ICreationResult<NoteModel>;
    }

    return {
      status: 'ok',
      data: this.vault.newNote(attrs),
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
        (preloadChildren && !noteInStore.areChildrenLoaded) ||
        (preloadLinks && !noteInStore.areLinksLoaded) ||
        (preloadBacklinks && !noteInStore.areBacklinksLoaded)
      ) {
        return this.preloadNote(
          id,
          preloadChildren,
          preloadLinks,
          preloadBacklinks,
        );
      } else {
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
    return this.db.notesChange$.pipe(
      liveSwitch(async () => {
        return (await this.db.notesQueries.getByTitles([title]))[0]?.id;
      }),
      distinctUntilChanged(),
    );
  }

  async updateNoteBlockLinks(noteBlock: NoteBlockModel) {
    return this.db.transaction(
      'r',
      this.db.notes,
      this.db.noteBlocks,
      async () => {
        console.log('updating links');

        const titles = (
          filterAst(
            noteBlock.content.ast,
            (t) => t.type === 'ref',
          ) as RefToken[]
        ).map((t: RefToken) => t.content);

        const existingNotesIndexed = Object.fromEntries(
          (await this.db.notesQueries.getByTitles(titles)).map((n) => [
            n.title,
            n,
          ]),
        );

        const allNotes = (
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

        const allNotesIndexed = Object.fromEntries(
          allNotes.map((n) => [n.$modelId, n]),
        );

        const existingLinkedNotesIndexed = Object.fromEntries(
          noteBlock.linkedNoteRefs.map((ref) => [ref.id, ref.current]),
        );

        allNotes.forEach((note) => {
          if (!existingLinkedNotesIndexed[note.$modelId]) {
            this.vault.createLink(note, noteBlock);
          }
        });

        Object.values(existingLinkedNotesIndexed).forEach((note) => {
          if (!allNotesIndexed[note.$modelId]) {
            this.vault.unlink(note, noteBlock);
          }
        });
      },
    );
  }

  async preloadNote(
    id: string,
    preloadChildren = true,
    preloadLinks = true,
    preloadBacklinks = true,
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

  // TODO: better Rx way, put title to pipe
  searchNotesTuples$(title: string) {
    return this.db.notesChange$.pipe(
      liveSwitch(async () =>
        (await this.db.notesQueries.searchNotes(title)).map((row) => ({
          id: row.id,
          title: row.title,
        })),
      ),
    );
  }

  getAllNotesTuples$() {
    return this.db.notesChange$.pipe(
      liveSwitch(async () =>
        (await this.db.notesQueries.all()).map((row) => ({
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
                linkedNoteIds: block.linkedNoteIds.filter(
                  (linkedId) => id !== linkedId,
                ),
              });
            }),
          ),
        ]);
      },
    );
  }

  destroy = () => {
    console.log(`Vault ${this.vault.$modelId} is closed`);

    this.db.close();
  };
}
