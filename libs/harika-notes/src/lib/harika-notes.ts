export { NoteDbModel } from './PersistentDb/models/NoteDbModel';
export { NoteBlockDbModel } from './PersistentDb/models/NoteBlockDbModel';
export { NoteRefDbModel } from './PersistentDb/models/NoteRefDbModel';
export { NoteMemModel } from './models/NoteMemModel';
export { NoteBlockMemModel, noteBlockRef } from './models/NoteBlockMemModel';
export { HarikaNotesTableName } from './PersistentDb/schema';
export { Store as MemoryDb } from './Store';

import { connectReduxDevTools, onPatches } from 'mobx-keystone';
import { Database, DatabaseAdapter } from '@nozbe/watermelondb';
import { Queries } from './PersistentDb/Queries';
import { Store } from './Store';
import * as remotedev from 'remotedev';
import { NoteRefDbModel } from './PersistentDb/models/NoteRefDbModel';
import { NoteBlockDbModel } from './PersistentDb/models/NoteBlockDbModel';
import { NoteDbModel } from './PersistentDb/models/NoteDbModel';
import { convertDbToMemNote } from './PersistentDb/convertDbToModel';
import { Dayjs } from 'dayjs';
import { ChangesHandler } from './ChangesHandler';

const setupDatabase = (adapter: DatabaseAdapter) => {
  return new Database({
    adapter,
    modelClasses: [NoteDbModel, NoteBlockDbModel, NoteRefDbModel],
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
      new ChangesHandler(database, this.queries).handlePatch
    );
  }

  async getOrCreateDailyNote(date: Dayjs) {
    const row = await this.queries.getDailyNote(date);

    if (row) {
      return this.convertNoteRowToModel(row);
    }

    return this.store.createDailyNote(date);
  }

  async findNote(id: string) {
    if (this.store.notesMap[id]) return this.store.notesMap[id];

    return this.convertNoteRowToModel(await this.queries.getNoteById(id));
  }

  private async convertNoteRowToModel(row: NoteDbModel) {
    if (this.store.notesMap[row.id]) return this.store.notesMap[row.id];

    const memNote = await convertDbToMemNote(row);

    this.store.addNewNote(memNote.note, memNote.noteBlocks);

    return memNote.note;
  }
}
