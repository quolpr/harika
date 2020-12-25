export { NoteModel } from './models/NoteModel';
export { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
export { Store } from './Store';
export { default as schema } from './db/schema';

import {
  connectReduxDevTools,
  onPatches,
  registerRootStore,
} from 'mobx-keystone';
import { Database, DatabaseAdapter } from '@nozbe/watermelondb';
import { Queries } from './db/Queries';
import { Store } from './Store';
import * as remotedev from 'remotedev';
import { NoteRefRow } from './db/rows/NoteRefRow';
import { NoteBlockRow } from './db/rows/NoteBlockRow';
import { NoteRow } from './db/rows/NoteRow';
import { convertNoteRowToModelAttrs } from './convertRowToModel';
import { Dayjs } from 'dayjs';
import { ChangesHandler } from './ChangesHandler';
import { NoteBlockModel } from './models/NoteBlockModel';

const setupDatabase = (adapter: DatabaseAdapter) => {
  return new Database({
    adapter,
    modelClasses: [NoteRow, NoteBlockRow, NoteRefRow],
    actionsEnabled: true,
  });
};

const setupStore = () => {
  const store = new Store({});

  const connection = remotedev.connectViaExtension({
    name: 'Harika store',
  });

  connectReduxDevTools(remotedev, connection, store);
  return store;
};

export class HarikaNotes {
  queries: Queries;
  store: Store;

  private areAllNotesLoaded = false;

  constructor(adapter: DatabaseAdapter) {
    const database = setupDatabase(adapter);
    this.queries = new Queries(database);
    this.store = setupStore();

    onPatches(
      this.store,
      new ChangesHandler(database, this.queries, this.store).handlePatch
    );

    registerRootStore(this.store);
  }

  async preloadAllNotes() {
    if (this.areAllNotesLoaded) return;

    // TODO: optimize
    const allNotes = await this.queries.getAllNotes();
    await Promise.all(
      allNotes.map((note) => {
        this.findNote(note.id, false, false);
      })
    );
    console.log(allNotes);
    this.areAllNotesLoaded = true;
  }

  getAllNotes() {
    return this.store.allNotes;
  }

  async getOrCreateDailyNote(date: Dayjs) {
    const noteRow = await this.queries.getDailyNoteRow(date);

    if (noteRow) {
      return this.findNote(noteRow.id);
    }

    return this.store.createDailyNote(date);
  }

  async findNote(id: string, preloadChildren = true, preloadLinks = true) {
    if (this.store.notesMap[id]) {
      const noteInStore = this.store.notesMap[id];

      if (
        !(preloadChildren && !noteInStore.areChildrenLoaded) &&
        !(preloadLinks && !noteInStore.areLinksLoaded)
      )
        return noteInStore;
    }

    return this.convertNoteRowToModel(
      await this.queries.getNoteRowById(id),
      preloadChildren,
      preloadLinks
    );
  }

  async updateNoteBlockLinks(noteBlock: NoteBlockModel) {
    const names = [...noteBlock.content.matchAll(/\[\[(.+?)\]\]/g)].map(
      ([, name]) => name
    );

    const existingNotesIndexed = Object.fromEntries(
      (await this.queries.getNoteRowsByNames(names)).map((n) => [n.title, n])
    );

    const allNotes = await Promise.all(
      names.map(async (name) => {
        if (!existingNotesIndexed[name]) {
          const newNote = this.store.createNote({ title: name });

          return newNote;
        } else {
          const existing = existingNotesIndexed[name];

          return this.findNote(existing.id, false);
        }
      })
    );

    const allNotesIndexed = Object.fromEntries(
      allNotes.map((n) => [n.$modelId, n])
    );

    const existingLinkedNotesIndexed = Object.fromEntries(
      noteBlock.linkedNoteRefs.map((note) => [
        note.current.$modelId,
        note.current,
      ])
    );

    allNotes.forEach((note) => {
      if (!existingLinkedNotesIndexed[note.$modelId]) {
        noteBlock.createLink(note);
      }
    });

    Object.values(existingLinkedNotesIndexed).map((note) => {
      if (!allNotesIndexed[note.$modelId]) {
        noteBlock.unlink(note);
      }
    });
  }

  // TODO: move it with findNote to separate class
  private async convertNoteRowToModel(
    row: NoteRow,
    preloadChildren = true,
    preloadLinks = true
  ) {
    const data = await convertNoteRowToModelAttrs(
      this.queries,
      row,
      preloadChildren,
      preloadLinks
    );

    const model = this.store.createOrUpdateNoteFromAttrs([
      { note: data.note, blocks: data.noteBlocks },
      ...data.linkedNotes.map(({ note, noteBlocks }) => ({
        note,
        blocks: noteBlocks,
      })),
    ]);

    return model[0];
  }
}
