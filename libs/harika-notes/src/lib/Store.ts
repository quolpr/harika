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
import { NoteBlockModel, noteBlockRef } from './models/NoteBlockModel';
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
  createOrUpdateNoteFromAttrs(
    list: Array<{
      note: ModelInstanceCreationData<NoteModel> & { $modelId: string };
      blocks: (ModelInstanceCreationData<NoteBlockModel> & {
        $modelId: string;
      })[];
    }>
  ) {
    return list.map(({ note, blocks }) => {
      if (!this.notesMap[note.$modelId]) {
        this.notesMap[note.$modelId] = new NoteModel(note);
      } else {
        const noteInStore = this.notesMap[note.$modelId];

        if (
          !noteInStore.areLinksLoaded &&
          note.areLinksLoaded &&
          note.linkedNoteBlockRefs
        ) {
          noteInStore.linkedNoteBlockRefs = note.linkedNoteBlockRefs;
          noteInStore.areLinksLoaded = true;
        }

        if (
          !noteInStore.areChildrenLoaded &&
          note.areChildrenLoaded &&
          note.childBlockRefs
        ) {
          noteInStore.childBlockRefs = note.childBlockRefs;
          noteInStore.areChildrenLoaded = true;
        }
      }

      blocks.forEach((block) => {
        if (!this.blocksMap[block.$modelId]) {
          this.blocksMap[block.$modelId] = new NoteBlockModel(block);
        }
      });

      return this.notesMap[note.$modelId];
    });
  }
}
