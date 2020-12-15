export { NoteDbModel as NoteDb } from './dbModels/NoteDbModel';
export { NoteBlockDb as NoteBlock } from './dbModels/NoteBlockDbModel';
export { NoteRef } from './dbModels/NoteRefDbModel';
export { NoteModel } from './models/NoteModel';
export { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
export { default as noteSchema, HarikaNotesTableName } from './dbModels/schema';

import { Dayjs } from 'dayjs';
import {
  model,
  Model,
  modelAction,
  ModelInstanceCreationData,
  prop,
} from 'mobx-keystone';
import { v4 as uuidv4 } from 'uuid';
import { Optional } from 'utility-types';
import { NoteModel } from './models/NoteModel';
import { noteBlockRef } from './models/NoteBlockModel';

@model('harika/HarikaStore')
export class HarikaStore extends Model({
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
}) {
  @modelAction
  createNote(
    attrs: Optional<
      ModelInstanceCreationData<NoteModel>,
      'updatedAt' | 'createdAt' | 'dailyNoteDate'
    >
  ) {
    const note = new NoteModel({
      $modelId: uuidv4(),
      updatedAt: new Date(),
      createdAt: new Date(),
      dailyNoteDate: new Date(),
      ...attrs,
    });

    this.notesMap[note.$modelId] = note;

    const block = note.createBlock({ content: '' });

    note.childBlockRefs = [noteBlockRef(block)];

    return note;
  }

  @modelAction
  getOrCreateDailyNote(date: Dayjs) {
    const title = date.format('D MMM YYYY');
    const startOfDate = date.startOf('day');

    const dailyNote = Object.values(this.notesMap).find(
      (n) => n.dailyNoteDate === startOfDate.toDate()
    );

    if (dailyNote) {
      return dailyNote;
    } else {
      return this.createNote({ title, dailyNoteDate: startOfDate.toDate() });
    }
  }
}

// export const getOrCreateDailyNote = async (database: Database, date: Dayjs) => {
//   const title = date.format('D MMM YYYY');
//   const startOfDate = date.startOf('day');
//
//   const noteCollection = database.collections.get<NoteDbModel>(
//     HarikaNotesTableName.NOTES
//   );
//   const noteBlockCollection = database.collections.get<NoteBlock>(
//     HarikaNotesTableName.NOTE_BLOCKS
//   );
//
//   const notes = await noteCollection
//     .query(Q.where('daily_note_date', startOfDate.unix() * 1000))
//     .fetch();
//
//   if (notes.length > 0) {
//     if (notes.length > 1) {
//       console.error(`Daily notes for ${title} is more then one!!`);
//     }
//
//     return notes[0];
//   } else {
//     return database.action<NoteDbModel>(async () => {
//       const newNote = await noteCollection.create((toCreate) => {
//         toCreate.title = title;
//         toCreate.dailyNoteDate = startOfDate.toDate();
//       });
//
//       await noteBlockCollection.create((toCreate) => {
//         toCreate.noteId = newNote.id;
//       });
//
//       return newNote;
//     });
//   }
// };
