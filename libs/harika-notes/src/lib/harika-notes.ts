export { Note } from './models/Note';
export { NoteBlock } from './models/NoteBlock';
export { default as noteSchema, HarikaNotesTableName } from './models/schema';

import { Note } from './models/Note';
import { NoteBlock } from './models/NoteBlock';
import { Database, Q } from '@nozbe/watermelondb';
import { Dayjs } from 'dayjs';
import { HarikaNotesTableName } from '..';

export const getOrCreateDailyNote = async (database: Database, date: Dayjs) => {
  const title = date.format('D MMM YYYY');

  const noteCollection = database.collections.get<Note>(
    HarikaNotesTableName.NOTES
  );
  const noteBlockCollection = database.collections.get<NoteBlock>(
    HarikaNotesTableName.NOTE_BLOCKS
  );

  const notes = await noteCollection.query(Q.where('title', title)).fetch();
  if (notes.length > 0) {
    if (notes.length > 1) {
      console.error(`Daily notes for ${title} is more then one!!`);
    }

    return notes[0];
  } else {
    return database.action<Note>(async () => {
      const newNote = await noteCollection.create((toCreate) => {
        toCreate.title = title;
      });

      await noteBlockCollection.create((toCreate) => {
        toCreate.note_id = newNote.id;
      });

      return newNote;
    });
  }
};
