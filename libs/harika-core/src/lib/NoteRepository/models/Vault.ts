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
import { vaultModelType } from './consts';
import { generateId } from '../../generateId';

// TODO: rename file

@model(vaultModelType)
export class VaultModel extends Model({
  name: prop<string>(),
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
  blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
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
      linkedNoteRefs: [],
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

  // TODO: maybe move link to block model?
  @modelAction
  createLink(note: NoteModel, noteBlock: NoteBlockModel) {
    noteBlock.linkedNoteRefs.push(noteRef(note));
  }

  @modelAction
  unlink(note: NoteModel, noteBlock: NoteBlockModel) {
    noteBlock.linkedNoteRefs.splice(
      noteBlock.linkedNoteRefs.findIndex(({ id }) => note.$modelId === id),
      1
    );
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

    return { notes, blocks };
  }
}
