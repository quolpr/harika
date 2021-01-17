import { ModelInstanceCreationData } from 'mobx-keystone';
import { Database, DatabaseAdapter } from '@nozbe/watermelondb';
import { Queries } from './Vault/db/Queries';
import { convertNoteRowToModelAttrs } from './Vault/convertRowToModel';
import { Dayjs } from 'dayjs';
import { NoteBlockModel } from './Vault/models/NoteBlockModel';
import { NoteModel } from './Vault/models/NoteModel';
import { Optional } from 'utility-types';
import { Required } from 'utility-types';
import { ICreationResult } from './Vault/types';
import { VaultModel } from './Vault/models/Vault';

export { NoteModel } from './Vault/models/NoteModel';
// TODO: rename to VaultModel
export { VaultModel as Vault } from './Vault/models/Vault';
export { NoteLinkModel } from './Vault/models/NoteLinkModel';
export { BlocksViewModel } from './Vault/models/BlocksViewModel';
export { NoteBlockModel, noteBlockRef } from './Vault/models/NoteBlockModel';

export interface IAdapterBuilder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (opts: { dbName: string; schema: any }): DatabaseAdapter;
}

// Row = DB projection of the model
// Model = DDD model
// Tuple = plain object data, used for fast data getting

// TODO: rename file
export class NoteRepository {
  constructor(private vaultDbs: Record<string, Database>) {}

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

    if (await this.getQueries(vault.$modelId).getIsNoteExists(attrs.title)) {
      return {
        status: 'error',
        errors: { title: ['Already exists'] },
      } as ICreationResult<NoteModel>;
    }

    return { status: 'ok', data: vault.createNote(attrs) } as ICreationResult<
      NoteModel
    >;
  }

  async getOrCreateDailyNote(
    this: NoteRepository,
    vault: VaultModel,
    date: Dayjs
  ) {
    const noteRow = await this.getQueries(vault.$modelId).getDailyNoteRow(date);

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

      if (
        !(preloadChildren && !noteInStore.areChildrenLoaded) &&
        !(preloadLinks && !noteInStore.areLinksLoaded)
      )
        return noteInStore;
    }

    return this.preloadNote(vault, id, preloadChildren, preloadLinks);
  }

  async updateNoteBlockLinks(vault: VaultModel, noteBlock: NoteBlockModel) {
    const names = [...noteBlock.content.matchAll(/\[\[(.+?)\]\]/g)].map(
      ([, name]) => name
    );

    const existingNotesIndexed = Object.fromEntries(
      (
        await this.getQueries(vault.$modelId).getNoteRowsByNames(names)
      ).map((n) => [n.title, n])
    );

    const allNotes = (
      await Promise.all(
        names.map(async (name) => {
          if (!existingNotesIndexed[name]) {
            const result = await this.createNote(vault, { title: name });

            if (result.status === 'ok') {
              return result.data;
            } else {
              alert(JSON.stringify(result.errors));
            }
          } else {
            const existing = existingNotesIndexed[name];

            return this.findNote(vault, existing.id, false);
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
    const row = await this.getQueries(vault.$modelId).getNoteRowById(id);
    const data = await convertNoteRowToModelAttrs(
      this.getQueries(vault.$modelId),
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

    return vault.notesMap[row.id];
  }

  async searchNotesTuples(vaultId: string, title: string) {
    return (await this.getQueries(vaultId).searchNotes(title)).map((row) => ({
      id: row.id,
      title: row.title,
    }));
  }

  async getAllNotesTuples(vaultId: string) {
    return (await this.getQueries(vaultId).getAllNotes()).map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
    }));
  }

  private getQueries(vaultId: string) {
    return new Queries(this.getDbByVaultId(vaultId));
  }

  private getDbByVaultId(vaultId: string) {
    if (!this.vaultDbs[vaultId])
      throw new Error('Vault db was not initialized!');

    return this.vaultDbs[vaultId];
  }
}
