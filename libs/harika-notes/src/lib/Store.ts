import { Dayjs } from 'dayjs';
import { computed } from 'mobx';
import {
  model,
  prop,
  modelAction,
  ModelInstanceCreationData,
  Model,
} from 'mobx-keystone';
import { Optional } from 'utility-types';
import { v4 as uuidv4 } from 'uuid';
import { NoteBlockModel } from './models/NoteBlockModel';
import { NoteModel } from './models/NoteModel';

@model('harika/HarikaStore')
export class Store extends Model({
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
  blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
}) {
  @computed({ keepAlive: true })
  get allNotes() {
    return Object.values(this.notesMap);
  }

  @modelAction
  createNote(
    attrs: Optional<
      ModelInstanceCreationData<NoteModel>,
      'createdAt' | 'dailyNoteDate'
    >
  ) {
    const note = new NoteModel({
      $modelId: uuidv4(),
      createdAt: new Date(),
      dailyNoteDate: new Date(),
      ...attrs,
    });

    this.notesMap[note.$modelId] = note;

    note.createBlock({ content: '', orderPosition: 0 });

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
  createOrUpdateNoteAndBlocksFromAttrs(
    noteAttrs: (ModelInstanceCreationData<NoteModel> & { $modelId: string })[],
    blocksAttrs: (ModelInstanceCreationData<NoteBlockModel> & {
      $modelId: string;
    })[]
  ) {
    const notes = noteAttrs.map((note) => {
      if (this.notesMap[note.$modelId]) {
        this.notesMap[note.$modelId].updateAttrs(note);
      } else {
        this.notesMap[note.$modelId] = new NoteModel(note);
      }

      return this.notesMap[note.$modelId];
    });

    const blocks = blocksAttrs.forEach((block) => {
      if (this.blocksMap[block.$modelId]) {
        this.blocksMap[block.$modelId].updateAttrs(block);
      } else {
        this.blocksMap[block.$modelId] = new NoteBlockModel(block);
      }

      return this.blocksMap[block.$modelId];
    });

    return { notes, blocks };
  }
}
