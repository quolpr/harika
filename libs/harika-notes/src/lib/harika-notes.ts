export { NoteDbModel } from './PersistentDb/models/NoteDbModel';
export { NoteBlockDbModel } from './PersistentDb/models/NoteBlockDbModel';
export { NoteRefDbModel } from './PersistentDb/models/NoteRefDbModel';
export { NoteMemModel } from './MemoryDb/models/NoteMemModel';
export {
  NoteBlockMemModel,
  noteBlockRef,
} from './MemoryDb/models/NoteBlockMemModel';
export { HarikaNotesTableName } from './PersistentDb/schema';
export { MemoryDb } from './MemoryDb/MemoryDb';

import { connectReduxDevTools } from 'mobx-keystone';
import { Database } from '@nozbe/watermelondb';
import { PersistentDb } from './PersistentDb/PersistentDb';
import { MemoryDb } from './MemoryDb/MemoryDb';
import * as remotedev from 'remotedev';
import schema from './PersistentDb/schema';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { NoteRefDbModel } from './PersistentDb/models/NoteRefDbModel';
import { NoteBlockDbModel } from './PersistentDb/models/NoteBlockDbModel';
import { NoteDbModel } from './PersistentDb/models/NoteDbModel';
import { convertDbToMemNote } from './convertDbToModel';
import { Dayjs } from 'dayjs';

export class HarikaNotes {
  watermelondb: Database;
  persistentDb: PersistentDb;
  private memDb: MemoryDb;

  constructor() {
    const adapter = new LokiJSAdapter({
      schema: schema,
      // migrations, // optional migrations
      useWebWorker: false, // recommended for new projects. tends to improve performance and reduce glitches in most cases, but also has downsides - test with and without it
      useIncrementalIndexedDB: true, // recommended for new projects. improves performance (but incompatible with early Watermelon databases)
      // dbName: 'myapp', // optional db name
      // It's recommended you implement this method:
      // onIndexedDBVersionChange: () => {
      //   // database was deleted in another browser tab (user logged out), so we must make sure we delete
      //   // it in this tab as well
      //   if (checkIfUserIsLoggedIn()) {
      //     window.location.reload()
      //   }
      // },
      // Optional:
      // onQuotaExceededError: (error) => { /* do something when user runs out of disk space */ },
    } as any);

    // Then, make a Watermelon database from it!
    this.watermelondb = new Database({
      adapter,
      modelClasses: [NoteDbModel, NoteBlockDbModel, NoteRefDbModel],
      actionsEnabled: true,
    });
    this.persistentDb = new PersistentDb(this.watermelondb);

    this.memDb = new MemoryDb({});
    const connection = remotedev.connectViaExtension({
      name: 'Harika store',
    });
    connectReduxDevTools(remotedev, connection, this.memDb);
  }

  getMemDb() {
    return this.memDb;
  }

  getPersistentDb() {
    return this.persistentDb;
  }

  async getOrCreateDailyNote(date: Dayjs) {
    const dailyNoteMem = this.memDb.getDailyNote(date);

    if (dailyNoteMem) return dailyNoteMem;

    const persistedNote = await this.persistentDb.getDailyNote(date);

    if (persistedNote) {
      const memNote = await convertDbToMemNote(persistedNote);

      this.memDb.addNewNote(memNote.note);

      return memNote.note;
    }

    return this.memDb.createDailyNote(date);
  }

  async findNote(id: string) {
    if (this.memDb.notesMap[id]) {
      return this.memDb.notesMap[id];
    }

    const persistedNote = await this.persistentDb.getNoteById(id);

    if (persistedNote) {
      const memNote = await convertDbToMemNote(persistedNote);

      this.memDb.addNewNote(memNote.note);

      return memNote.note;
    }

    return;
  }
}
