export { NoteDbModel } from './PersistentDb/models/NoteDbModel';
export { NoteBlockDbModel } from './PersistentDb/models/NoteBlockDbModel';
export { NoteRefDbModel } from './PersistentDb/models/NoteRefDbModel';
export { NoteMemModel } from './MemoryDb/models/NoteMemModel';
export {
  NoteBlockMemModel,
  noteBlockRef,
} from './MemoryDb/models/NoteBlockMemModel';
export { HarikaNotesTableName } from './PersistentDb/schema';
export { Store as MemoryDb } from './MemoryDb/MemoryDb';

import {
  connectReduxDevTools,
  ModelPropsData,
  onPatches,
  Patch,
} from 'mobx-keystone';
import { Database } from '@nozbe/watermelondb';
import { PersistentDb } from './PersistentDb/PersistentDb';
import { Store } from './MemoryDb/MemoryDb';
import * as remotedev from 'remotedev';
import schema from './PersistentDb/schema';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { NoteRefDbModel } from './PersistentDb/models/NoteRefDbModel';
import { NoteBlockDbModel } from './PersistentDb/models/NoteBlockDbModel';
import { NoteDbModel } from './PersistentDb/models/NoteDbModel';
import { convertDbToMemNote } from './convertDbToModel';
import { Dayjs } from 'dayjs';
import { NoteBlockMemModel } from '..';

export class HarikaNotes {
  watermelondb: Database;
  persistentDb: PersistentDb;
  private memDb: Store;

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

    this.memDb = new Store({});
    const connection = remotedev.connectViaExtension({
      name: 'Harika store',
    });
    connectReduxDevTools(remotedev, connection, this.memDb);

    onPatches(this.memDb, this.handlePatch);
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

      this.memDb.addNewNote(memNote.note, memNote.noteBlocks);

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

      this.memDb.addNewNote(memNote.note, memNote.noteBlocks);

      return memNote.note;
    }

    return;
  }

  private handlePatch = (patches: Patch[]) => {
    patches.forEach(async (patch) => {
      if (patch.op === 'add') {
        if (patch.path.length === 2 && patch.path[0] === 'blocksMap') {
          const value: ModelPropsData<NoteBlockMemModel> & {
            $modelId: string;
          } = patch.value;

          if (value.isPersisted) return;

          this.watermelondb.action(() => {
            return this.persistentDb.noteBlocksCollection.create((creator) => {
              creator._raw.id = value.$modelId;
              creator.noteId = value.noteRef.id;
              creator.parentBlockId = value.parentBlockRef?.id;
              creator.content = value.content;
              creator.createdAt = new Date(value.createdAt);
              creator.updatedAt = new Date(value.updatedAt);
            });
          });
        }
      }

      if (patch.op === 'replace') {
        if (patch.path.length === 3 && patch.path[0] === 'blocksMap') {
          const noteBlock = await this.persistentDb.noteBlocksCollection.find(
            patch.path[1] as string
          );

          this.watermelondb.action(async () => {
            return noteBlock.update((toUpdate) => {
              if (patch.path[2] === 'parentBlockRef') {
                toUpdate.parentBlockId = patch.value.id;
              }

              if (patch.path[2] === 'content') {
                toUpdate.content = patch.value;
              }
            });
          });
        }
      }
    });
  };
}
