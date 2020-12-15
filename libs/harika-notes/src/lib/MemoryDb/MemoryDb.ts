import { Dayjs } from 'dayjs';
import {
  model,
  prop,
  modelAction,
  ModelInstanceCreationData,
  Model,
} from 'mobx-keystone';
import { Optional } from 'utility-types';
import { v4 as uuidv4 } from 'uuid';
import { noteBlockRef } from './models/NoteBlockMemModel';
import { NoteMemModel } from './models/NoteMemModel';

@model('harika/HarikaStore')
export class MemoryDb extends Model({
  notesMap: prop<Record<string, NoteMemModel>>(() => ({})),
}) {
  @modelAction
  createNote(
    attrs: Optional<
      ModelInstanceCreationData<NoteMemModel>,
      'updatedAt' | 'createdAt' | 'dailyNoteDate'
    >
  ) {
    const note = new NoteMemModel({
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

  getDailyNote(date: Dayjs) {
    const startOfDate = date.startOf('day');

    return Object.values(this.notesMap).find(
      (n) => n.dailyNoteDate === startOfDate.toDate()
    );
  }

  @modelAction
  createDailyNote(date: Dayjs) {
    const title = date.format('D MMM YYYY');
    const startOfDate = date.startOf('day');

    return this.createNote({ title, dailyNoteDate: startOfDate.toDate() });
  }

  @modelAction
  addNewNote(note: NoteMemModel) {
    this.notesMap[note.$modelId] = note;
  }
}
