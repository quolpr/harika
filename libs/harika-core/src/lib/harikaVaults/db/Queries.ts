import { Collection, Database, Q } from '@nozbe/watermelondb';
import { Dayjs } from 'dayjs';
import { NoteBlockRow } from './rows/NoteBlockRow';
import { NoteLinkRow } from './rows/NoteLinkRow';
import { NoteRow } from './rows/NoteRow';
import { HarikaNotesTableName } from './schema';

export class Queries {
  private database: Database;
  notesCollection: Collection<NoteRow>;
  noteBlocksCollection: Collection<NoteBlockRow>;
  noteLinksCollection: Collection<NoteLinkRow>;

  constructor(database: Database) {
    this.database = database;

    this.notesCollection = this.database.collections.get<NoteRow>(
      HarikaNotesTableName.NOTES
    );

    this.noteBlocksCollection = this.database.collections.get<NoteBlockRow>(
      HarikaNotesTableName.NOTE_BLOCKS
    );

    this.noteLinksCollection = this.database.collections.get<NoteLinkRow>(
      HarikaNotesTableName.NOTE_LINKS
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

  async getNoteBlockRowById(id: string) {
    const noteBlockCollection = this.database.collections.get<NoteBlockRow>(
      HarikaNotesTableName.NOTE_BLOCKS
    );

    return noteBlockCollection.find(id);
  }

  async getNoteRowsByNames(names: string[]) {
    return this.notesCollection.query(Q.where('title', Q.oneOf(names))).fetch();
  }

  async getNoteBlockRowsByIds(noteBlockIds: string[]) {
    return this.noteBlocksCollection
      .query(Q.where('id', Q.oneOf(noteBlockIds)))
      .fetch();
  }

  async getNoteRowsOfNoteBlockIds(noteBlockIds: string[]) {
    // TODO: check that no duplication
    return this.notesCollection
      .query(
        Q.on(
          HarikaNotesTableName.NOTE_BLOCKS,
          Q.where('id', Q.oneOf(noteBlockIds))
        )
      )
      .fetch();
  }

  async getAllNotes() {
    return this.notesCollection.query().fetch();
  }

  async getLinksByBlockIds(ids: string[]) {
    return this.noteLinksCollection
      .query(Q.where('note_block_id', Q.oneOf(ids)))
      .fetch();
  }

  async searchNotes(title: string) {
    return this.notesCollection
      .query(Q.where('title', Q.like(`%${title}%`)))
      .fetch();
  }
}
