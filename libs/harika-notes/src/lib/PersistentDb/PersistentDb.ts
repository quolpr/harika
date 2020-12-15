import { Database, Q } from '@nozbe/watermelondb';
import { Dayjs } from 'dayjs';
import { NoteDbModel } from './models/NoteDbModel';
import { HarikaNotesTableName } from './schema';

export class PersistentDb {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async getDailyNote(date: Dayjs) {
    const startOfDate = date.startOf('day');

    const noteCollection = this.database.collections.get<NoteDbModel>(
      HarikaNotesTableName.NOTES
    );

    const notes: NoteDbModel[] = await noteCollection
      .query(Q.where('daily_note_date', startOfDate.unix() * 1000))
      .fetch();

    if (notes.length > 0) {
      if (notes.length > 1) {
        console.error(`Daily notes for ${startOfDate} is more then one!!`);
      }

      return notes[0];
    } else {
      return;
    }
  }

  async getNoteById(id: string) {
    const noteCollection = this.database.collections.get<NoteDbModel>(
      HarikaNotesTableName.NOTES
    );

    return noteCollection.find(id);
  }
}
