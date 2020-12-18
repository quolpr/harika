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
import { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
import { NoteModel } from './models/NoteModel';

@model('harika/HarikaStore')
export class Store extends Model({
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
  blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
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

    note.childBlockRefs.push(noteBlockRef(block));

    return note;
  }

  @modelAction
  createDailyNote(date: Dayjs) {
    const title = date.format('D MMM YYYY');
    const startOfDate = date.startOf('day');

    return this.createNote({ title, dailyNoteDate: startOfDate.toDate() });
  }

  @modelAction
  addNewNote(note: NoteModel, blocks: NoteBlockModel[]) {
    this.notesMap[note.$modelId] = note;

    blocks.forEach((block) => {
      this.blocksMap[block.$modelId] = block;
    });
  }
}
