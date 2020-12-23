import { Collection, Database, Q } from '@nozbe/watermelondb';
import { Dayjs } from 'dayjs';
import { NoteBlockRow } from './rows/NoteBlockRow';
import { NoteRow } from './rows/NoteRow';
import { HarikaNotesTableName } from './schema';

export class Queries {
  private database: Database;
  notesCollection: Collection<NoteRow>;
  noteBlocksCollection: Collection<NoteBlockRow>;

  constructor(database: Database) {
    this.database = database;

    this.notesCollection = this.database.collections.get<NoteRow>(
      HarikaNotesTableName.NOTES
    );

    this.noteBlocksCollection = this.database.collections.get<NoteBlockRow>(
      HarikaNotesTableName.NOTE_BLOCKS
    );
  }

  async getDailyNoteRow(date: Dayjs) {
    const startOfDate = date.startOf('day');

    const noteRows: NoteRow[] = await this.notesCollection
      .query(Q.where('daily_note_date', startOfDate.unix() * 1000))
      .fetch();

    if (noteRows.length > 0) {
      if (noteRows.length > 1) {
        console.error(`Daily notes for ${startOfDate} is more then one!!`);
      }

      return noteRows[0];
    } else {
      return;
    }
  }

  async getNoteRowById(id: string) {
    const noteCollection = this.database.collections.get<NoteRow>(
      HarikaNotesTableName.NOTES
    );

    return noteCollection.find(id);
  }

  async getNoteRowsByNames(names: string[]) {
    return this.notesCollection.query(Q.where('title', Q.oneOf(names))).fetch();
  }
}
