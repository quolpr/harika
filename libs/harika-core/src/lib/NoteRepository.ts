import { ModelInstanceCreationData } from 'mobx-keystone';
import { Database, DatabaseAdapter } from '@nozbe/watermelondb';
import { Queries } from './NoteRepository/db/Queries';
import { convertNoteRowToModelAttrs } from './NoteRepository/convertRowToModel';
import { Dayjs } from 'dayjs';
import { NoteBlockModel } from './NoteRepository/models/NoteBlockModel';
import { NoteModel } from './NoteRepository/models/NoteModel';
import { Optional } from 'utility-types';
import { Required } from 'utility-types';
import { ICreationResult } from './NoteRepository/types';
import { VaultModel } from './NoteRepository/models/Vault';
import { map } from 'rxjs/operators';
import { HarikaRxDatabase } from './NoteRepository/rxdb/initDb';

export { NoteModel } from './NoteRepository/models/NoteModel';
// TODO: rename to VaultModel
export { VaultModel as Vault } from './NoteRepository/models/Vault';
export { NoteLinkModel } from './NoteRepository/models/NoteLinkModel';
export { BlocksViewModel } from './NoteRepository/models/BlocksViewModel';
export {
  NoteBlockModel,
  noteBlockRef,
} from './NoteRepository/models/NoteBlockModel';

export interface IAdapterBuilder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (opts: { dbName: string; schema: any }): DatabaseAdapter;
}

// Row = DB projection of the model
// Model = DDD model
// Tuple = plain object data, used for fast data getting

// TODO refactor Row to Db postfix.
export class NoteRepository {
  constructor(private vaultRxDbs: Record<string, HarikaRxDatabase>) {}

  async createNote(
    vault: VaultModel,
    attrs: Required<
      Optional<
        ModelInstanceCreationData<NoteModel>,
        'createdAt' | 'dailyNoteDate'
      >,
      'title'
    >
  ) {
    if (attrs.title.trim().length === 0) {
      return {
        status: 'error',
        errors: { title: ["Can't be empty"] },
      } as ICreationResult<NoteModel>;
    }

    if (
      await this.getDbByVaultId(vault.$modelId).notes.getIsNoteExists(
        attrs.title
      )
    ) {
      return {
        status: 'error',
        errors: { title: ['Already exists'] },
      } as ICreationResult<NoteModel>;
    }

    return { status: 'ok', data: vault.newNote(attrs) } as ICreationResult<
      NoteModel
    >;
  }

  async getOrCreateDailyNote(
    this: NoteRepository,
    vault: VaultModel,
    date: Dayjs
  ) {
    const noteRow = await this.getDbByVaultId(
      vault.$modelId
    ).notes.getDailyNote(date);

    if (noteRow) {
      return {
        status: 'ok',
        data: await this.findNote(vault, noteRow._id),
      } as ICreationResult<NoteModel>;
    }

    const title = date.format('D MMM YYYY');
    const startOfDate = date.startOf('day');

    return await this.createNote(vault, {
      title,
      dailyNoteDate: startOfDate.toDate(),
    });
  }

  async sync() {
    return true;
    // return this.syncer.sync();
  }

  async findNote(
    vault: VaultModel,
    id: string,
    preloadChildren = true,
    preloadLinks = true
  ) {
    if (vault.notesMap[id]) {
      const noteInStore = vault.notesMap[id];

      if (vault.notesMap[id].isDeleted) return;

      if (
        !(preloadChildren && !noteInStore.areChildrenLoaded) &&
        !(preloadLinks && !noteInStore.areLinksLoaded)
      )
        return noteInStore;
    }

    return this.preloadNote(vault, id, preloadChildren, preloadLinks);
  }

  async updateNoteBlockLinks(vault: VaultModel, noteBlock: NoteBlockModel) {
    // TODO: use parser
    const titles = [...noteBlock.content.matchAll(/\[\[(.+?)\]\]/g)].map(
      ([, name]) => name
    );

    const existingNotesIndexed = Object.fromEntries(
      (
        await this.getDbByVaultId(vault.$modelId).notes.getByTitles(titles)
      ).map((n) => [n.title, n])
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

            return this.findNote(vault, existing._id, false);
          }
        })
      )
    ).flatMap((n) => (n ? [n] : []));

    const allNotesIndexed = Object.fromEntries(
      allNotes.map((n) => [n.$modelId, n])
    );

    const existingLinkedNotesIndexed = Object.fromEntries(
      noteBlock.noteLinks.map((link) => [link.noteRef.id, link.noteRef.current])
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
  }

  async preloadNote(
    vault: VaultModel,
    id: string,
    preloadChildren = true,
    preloadLinks = true
  ) {
    const row = await this.getDbByVaultId(vault.$modelId).notes.getNoteById(id);

    if (!row) return;

    const data = await convertNoteRowToModelAttrs(
      this.getDbByVaultId(vault.$modelId),
      row,
      preloadChildren,
      preloadLinks
    );

    vault.createOrUpdateEntitiesFromAttrs(
      [data.note, ...data.linkedNotes.map(({ note }) => note)],
      [
        ...data.noteBlocks,
        ...data.linkedNotes.flatMap(({ noteBlocks }) => noteBlocks),
      ],
      [
        ...data.noteLinks,
        ...data.linkedNotes.flatMap(({ noteLinks }) => noteLinks),
      ]
    );

    return vault.notesMap[row._id];
  }

  // TODO: Rx way
  async searchNotesTuples(vaultId: string, title: string) {
    return (await this.getDbByVaultId(vaultId).notes.searchNotes(title)).map(
      (row) => ({
        id: row._id,
        title: row.title,
      })
    );
  }

  getAllNotesTuples(vaultId: string) {
    return this.getDbByVaultId(vaultId)
      .notes.find()
      .$.pipe(
        map((rows) =>
          rows.map((row) => ({
            id: row._id,
            title: row.title,
            createdAt: new Date(row.createdAt),
          }))
        )
      );
  }

  private getDbByVaultId(vaultId: string) {
    if (!this.vaultRxDbs[vaultId])
      throw new Error('NoteRepository vaultDb was not initialized!');

    return this.vaultRxDbs[vaultId];
  }
}
