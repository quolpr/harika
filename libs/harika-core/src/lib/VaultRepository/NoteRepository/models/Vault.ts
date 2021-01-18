import {
  Model,
  model,
  modelAction,
  ModelInstanceCreationData,
  prop,
} from 'mobx-keystone';
import { NoteModel, noteRef } from './NoteModel';
import { v4 as uuidv4 } from 'uuid';
import { Optional, Required } from 'utility-types';
import { NoteBlockModel, noteBlockRef } from './NoteBlockModel';
import { BlocksViewModel } from './BlocksViewModel';
import { NoteLinkModel } from './NoteLinkModel';

const modelType = 'harika/NoteRepository';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isVault = (model: any): model is VaultModel =>
  '$modelType' in model && model.$modelType === modelType;

// TODO: rename file

@model(modelType)
export class VaultModel extends Model({
  name: prop<string>(),
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
  blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
  blocksViewsMap: prop<Record<string, BlocksViewModel>>(() => ({})),
  // TODO: could be optimize with Record
  noteLinks: prop<NoteLinkModel[]>(() => []),
}) {
  @modelAction
  createNote(
    attrs: Required<
      Optional<
        ModelInstanceCreationData<NoteModel>,
        'createdAt' | 'dailyNoteDate'
      >,
      'title'
    >
  ) {
    const note = new NoteModel({
      $modelId: uuidv4(),
      createdAt: new Date(),
      dailyNoteDate: new Date(),
      areLinksLoaded: true,
      areChildrenLoaded: true,
      ...attrs,
    });

    this.notesMap[note.$modelId] = note;

    note.createBlock({ content: '', orderPosition: 0 });

    return note;
  }

  @modelAction
  createLink(note: NoteModel, noteBlock: NoteBlockModel) {
    const link = new NoteLinkModel({
      $modelId: uuidv4(),
      noteRef: noteRef(note),
      noteBlockRef: noteBlockRef(noteBlock),
      createdAt: new Date(),
    });

    this.noteLinks.push(link);

    return link;
  }

  @modelAction
  unlink(note: NoteModel, noteBlock: NoteBlockModel) {
    const link = this.noteLinks.find(
      (link) =>
        link.noteBlockRef.id === noteBlock.$modelId &&
        link.noteRef.id === note.$modelId
    );

    if (!link) return;

    link.markAsDeleted();

    this.noteLinks.splice(this.noteLinks.indexOf(link), 1);
  }

  @modelAction
  getOrCreateViewByModel(model: { $modelId: string; $modelType: string }) {
    const key = `${model.$modelType}-${model.$modelId}`;

    if (this.blocksViewsMap[key]) return this.blocksViewsMap[key];

    this.blocksViewsMap[key] = new BlocksViewModel({});

    return this.blocksViewsMap[key];
  }

  @modelAction
  createOrUpdateEntitiesFromAttrs(
    noteAttrs: (ModelInstanceCreationData<NoteModel> & {
      $modelId: string;
    })[],
    blocksAttrs: (ModelInstanceCreationData<NoteBlockModel> & {
      $modelId: string;
    })[],
    noteLinksAttrs: (ModelInstanceCreationData<NoteLinkModel> & {
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

    const blocks = blocksAttrs.map((block) => {
      if (this.blocksMap[block.$modelId]) {
        this.blocksMap[block.$modelId].updateAttrs(block);
      } else {
        this.blocksMap[block.$modelId] = new NoteBlockModel(block);
      }

      return this.blocksMap[block.$modelId];
    });

    const noteLinks = noteLinksAttrs.map((link) => {
      let linkInStore = this.noteLinks.find(
        ({ $modelId }) => $modelId === link.$modelId
      );

      if (!linkInStore) {
        linkInStore = new NoteLinkModel(link);

        this.noteLinks.push(linkInStore);
      }

      return linkInStore;
    });

    return { notes, blocks, noteLinks };
  }
}
