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

    return this.createNote({
      title,
      dailyNoteDate: startOfDate.toDate(),
      areLinksLoaded: true,
      areChildrenLoaded: true,
    });
  }

  @modelAction
  addNewNote(note: NoteModel, blocks: NoteBlockModel[]) {
    if (!this.notesMap[note.$modelId]) {
      this.notesMap[note.$modelId] = note;
    } else {
      const noteInStore = this.notesMap[note.$modelId];

      if (!noteInStore.areLinksLoaded) {
        noteInStore.linkedNoteBlockRefs = note.linkedNoteBlockRefs.map((ref) =>
          noteBlockRef(ref.id)
        );
        noteInStore.areLinksLoaded = note.areLinksLoaded;
      }

      if (!noteInStore.areChildrenLoaded) {
        noteInStore.childBlockRefs = note.childBlockRefs.map((ref) =>
          noteBlockRef(ref.id)
        );
        noteInStore.areChildrenLoaded = note.areChildrenLoaded;
      }
    }

    blocks.forEach((block) => {
      if (!this.blocksMap[block.$modelId]) {
        this.blocksMap[block.$modelId] = block;
      }
    });
  }
}
