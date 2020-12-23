export { NoteModel } from './models/NoteModel';
export { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
export { Store } from './Store';
export { default as schema } from './db/schema';

import { connectReduxDevTools, onPatches } from 'mobx-keystone';
import { Database, DatabaseAdapter } from '@nozbe/watermelondb';
import { Queries } from './db/Queries';
import { Store } from './Store';
import * as remotedev from 'remotedev';
import { NoteRefRow } from './db/rows/NoteRefRow';
import { NoteBlockRow } from './db/rows/NoteBlockRow';
import { NoteRow } from './db/rows/NoteRow';
import { convertNoteRowToModel } from './convertRowToModel';
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

  constructor(adapter: DatabaseAdapter) {
    const database = setupDatabase(adapter);
    this.queries = new Queries(database);
    this.store = setupStore();

    onPatches(
      this.store,
      new ChangesHandler(database, this.queries, this.store).handlePatch
    );
  }

  async getOrCreateDailyNote(date: Dayjs) {
    const noteRow = await this.queries.getDailyNoteRow(date);

    if (noteRow) {
      return this.convertNoteRowToModel(noteRow);
    }

    return this.store.createDailyNote(date);
  }

  async findNote(id: string, preloadChildren = true) {
    if (this.store.notesMap[id]) return this.store.notesMap[id];

    return this.convertNoteRowToModel(
      await this.queries.getNoteRowById(id),
      preloadChildren
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

          return this.convertNoteRowToModel(existing, false);
        }
      })
    );

    const allNotesIndexed = Object.fromEntries(
      allNotes.map((n) => [n.$modelId, n])
    );

    const existingLinkedNotesIndexed = Object.fromEntries(
      noteBlock.linkedNotes.map((note) => [note.current.$modelId, note.current])
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

  private async convertNoteRowToModel(row: NoteRow, preloadChildren = true) {
    if (this.store.notesMap[row.id]) return this.store.notesMap[row.id];

    const data = await convertNoteRowToModel(row, preloadChildren);

    this.store.addNewNote(data.note, data.noteBlocks);

    return data.note;
  }
}
