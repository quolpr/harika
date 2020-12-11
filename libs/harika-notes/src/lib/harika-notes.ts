export { Note } from './models/Note';
export { NoteBlock } from './models/NoteBlock';
export { NoteRef } from './models/NoteRef';
export { default as noteSchema, HarikaNotesTableName } from './models/schema';

import { Note } from './models/Note';
import { NoteBlock } from './models/NoteBlock';
import { Database, Q } from '@nozbe/watermelondb';
import { Dayjs } from 'dayjs';
import { HarikaNotesTableName } from './models/schema';

export const getOrCreateDailyNote = async (database: Database, date: Dayjs) => {
  const title = date.format('D MMM YYYY');
  const startOfDate = date.startOf('day');

  const noteCollection = database.collections.get<Note>(
    HarikaNotesTableName.NOTES
  );
  const noteBlockCollection = database.collections.get<NoteBlock>(
    HarikaNotesTableName.NOTE_BLOCKS
  );

  const notes = await noteCollection
    .query(Q.where('daily_note_date', startOfDate.unix() * 1000))
    .fetch();

  if (notes.length > 0) {
    if (notes.length > 1) {
      console.error(`Daily notes for ${title} is more then one!!`);
    }

    return notes[0];
  } else {
    return database.action<Note>(async () => {
      const newNote = await noteCollection.create((toCreate) => {
        toCreate.title = title;
        toCreate.dailyNoteDate = startOfDate.toDate();
      });

      await noteBlockCollection.create((toCreate) => {
        toCreate.noteId = newNote.id;
      });

      return newNote;
    });
  }
};

// TODO: createNote()
