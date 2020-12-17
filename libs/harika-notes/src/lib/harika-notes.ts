export { NoteRow } from './PersistentDb/models/NoteDbModel';
export { NoteBlockRow } from './PersistentDb/models/NoteBlockDbModel';
export { NoteRefRow } from './PersistentDb/models/NoteRefDbModel';
export { NoteModel } from './models/NoteMemModel';
export { NoteBlockModel, noteBlockRef } from './models/NoteBlockMemModel';
export { HarikaNotesTableName } from './PersistentDb/schema';
export { Store } from './Store';
export { default as schema } from './PersistentDb/schema';

import { connectReduxDevTools, onPatches } from 'mobx-keystone';
import { Database, DatabaseAdapter } from '@nozbe/watermelondb';
import { Queries } from './PersistentDb/Queries';
import { Store } from './Store';
import * as remotedev from 'remotedev';
import { NoteRefRow } from './PersistentDb/models/NoteRefDbModel';
import { NoteBlockRow } from './PersistentDb/models/NoteBlockDbModel';
import { NoteRow } from './PersistentDb/models/NoteDbModel';
import { convertNoteRowToModel } from './PersistentDb/convertDbToModel';
import { Dayjs } from 'dayjs';
import { ChangesHandler } from './ChangesHandler';

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
      new ChangesHandler(database, this.queries).handlePatch
    );
  }

  async getOrCreateDailyNote(date: Dayjs) {
    const noteRow = await this.queries.getDailyNoteRow(date);

    if (noteRow) {
      return this.convertNoteRowToModel(noteRow);
    }

    return this.store.createDailyNote(date);
  }

  async findNote(id: string) {
    if (this.store.notesMap[id]) return this.store.notesMap[id];

    return this.convertNoteRowToModel(await this.queries.getNoteRowById(id));
  }

  private async convertNoteRowToModel(row: NoteRow) {
    if (this.store.notesMap[row.id]) return this.store.notesMap[row.id];

    const data = await convertNoteRowToModel(row);

    this.store.addNewNote(data.note, data.noteBlocks);

    return data.note;
  }
}
