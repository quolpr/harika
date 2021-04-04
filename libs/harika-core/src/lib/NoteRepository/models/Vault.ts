import {
  Model,
  model,
  modelAction,
  ModelInstanceCreationData,
  prop,
  Ref,
} from 'mobx-keystone';
import { NoteModel, noteRef } from './NoteModel';
import { v4 as uuidv4 } from 'uuid';
import { Optional, Required } from 'utility-types';
import { NoteBlockModel, noteBlockRef } from './NoteBlockModel';
import { BlocksViewModel } from './BlocksViewModel';
import { NoteLinkModel } from './NoteLinkModel';
import { vaultModelType } from './consts';
import { generateId } from '../../generateId';

// TODO: rename file

@model(vaultModelType)
export class VaultModel extends Model({
  name: prop<string>(),
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
  blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
  // TODO: could be optimize with Record
  noteLinks: prop<NoteLinkModel[]>(() => []),
}) {
  blocksViewsMap: Record<string, BlocksViewModel> = {};

  @modelAction
  newNote(
    attrs: Required<
      Optional<
        ModelInstanceCreationData<NoteModel>,
        'createdAt' | 'dailyNoteDate' | 'rootBlockRef'
      >,
      'title'
    >
  ) {
    const noteId = generateId();

    const rootBlock = new NoteBlockModel({
      $modelId: generateId(),
      createdAt: new Date(),
      noteRef: noteRef(noteId),
      noteBlockRefs: [],
      content: '',
    });

    const note = new NoteModel({
      $modelId: noteId,
      createdAt: new Date(),
      dailyNoteDate: new Date(),
      areLinksLoaded: true,
      areChildrenLoaded: true,
      rootBlockRef: noteBlockRef(rootBlock),
      ...attrs,
    });

    this.notesMap[note.$modelId] = note;
    this.blocksMap[rootBlock.$modelId] = rootBlock;

    note.createBlock({ content: '' }, rootBlock, 0);

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

    link.delete();
  }

  @modelAction
  getOrCreateViewByModel(model: { $modelId: string; $modelType: string }) {
    const key = `${model.$modelType}-${model.$modelId}`;

    if (this.blocksViewsMap[key]) return this.blocksViewsMap[key];

    this.blocksViewsMap[key] = new BlocksViewModel({ $modelId: key });

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

    blocks.forEach((model) => {
      const toRemoveRefs = model.noteBlockRefs
        .map((ref, i) => {
          if (!this.blocksMap[ref.id]) {
            return ref;
          }

          return false;
        })
        .filter(Boolean) as Ref<NoteBlockModel>[];

      toRemoveRefs.forEach((ref) => {
        console.error(
          'removing noteblock ref',
          ref.id,
          model.noteBlockRefs.indexOf(ref)
        );

        model.noteBlockRefs.splice(model.noteBlockRefs.indexOf(ref), 1);
      });

      if (toRemoveRefs.length) {
        console.log(model.noteBlockRefs);
      }
    });

    return { notes, blocks, noteLinks };
  }
}
