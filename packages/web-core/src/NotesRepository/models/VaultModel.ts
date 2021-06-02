import {
  Model,
  model,
  modelAction,
  ModelCreationData,
  prop,
  Ref,
} from 'mobx-keystone';
import { NoteModel, noteRef } from './NoteModel';
import type { Optional, Required } from 'utility-types';
import { NoteBlockModel, noteBlockRef } from './NoteBlockModel';
import { BlocksViewModel } from './BlocksViewModel';
import { vaultModelType } from './consts';
import { generateId } from '@harika/common';
import { BlockContentModel } from './BlockContentModel';

@model(vaultModelType)
export class VaultModel extends Model({
  name: prop<string>(),
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
  blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
  blocksViewsMap: prop<Record<string, BlocksViewModel>>(() => ({})),
}) {
  @modelAction
  newNote(
    attrs: Required<
      Optional<
        ModelCreationData<NoteModel>,
        | 'areLinksLoaded'
        | 'areChildrenLoaded'
        | 'areBacklinksLoaded'
        | 'createdAt'
        | 'dailyNoteDate'
        | 'rootBlockRef'
      >,
      'title'
    >,
    options?: { addEmptyBlock?: boolean },
  ) {
    options = { addEmptyBlock: true, ...options };

    const noteId = generateId();

    const rootBlock = new NoteBlockModel({
      $modelId: generateId(),
      createdAt: new Date().getTime(),
      noteRef: noteRef(noteId),
      noteBlockRefs: [],
      content: new BlockContentModel({ value: '' }),
      linkedNoteRefs: [],
    });

    const note = new NoteModel({
      $modelId: noteId,
      createdAt: new Date().getTime(),
      dailyNoteDate: new Date().getTime(),
      areLinksLoaded: true,
      areChildrenLoaded: true,
      areBacklinksLoaded: true,
      rootBlockRef: noteBlockRef(rootBlock),
      ...attrs,
    });

    this.notesMap[note.$modelId] = note;
    this.blocksMap[rootBlock.$modelId] = rootBlock;

    if (options.addEmptyBlock) {
      note.createBlock(
        { content: new BlockContentModel({ value: '' }) },
        rootBlock,
        0,
      );
    }

    return note;
  }

  @modelAction
  getOrCreateViewByModel(
    note: NoteModel,
    model: { $modelId: string; $modelType: string },
  ) {
    const key = `${model.$modelType}-${model.$modelId}`;

    if (this.blocksViewsMap[key]) return this.blocksViewsMap[key];

    this.blocksViewsMap[key] = new BlocksViewModel({
      $modelId: key,
      noteRef: noteRef(note),
    });

    return this.blocksViewsMap[key];
  }

  @modelAction
  createOrUpdateEntitiesFromAttrs(
    noteAttrs: (ModelCreationData<NoteModel> & {
      $modelId: string;
    })[],
    blocksAttrs: (ModelCreationData<NoteBlockModel> & {
      $modelId: string;
    })[],
  ) {
    console.debug(
      'createOrUpdateEntitiesFromAttrs, notes: ',
      JSON.stringify(
        {
          noteAttrs: noteAttrs.map(
            ({
              $modelId,
              title,
              areBacklinksLoaded,
              areChildrenLoaded,
              areLinksLoaded,
            }) => ({
              $modelId,
              title,
              areBacklinksLoaded,
              areChildrenLoaded,
              areLinksLoaded,
            }),
          ),
          blocksAttrs: blocksAttrs,
        },
        null,
        2,
      ),
    );

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
          'removing noteblock ref cause noteblock was not found',
          ref.id,
          JSON.stringify(model.noteBlockRefs.indexOf(ref)),
        );

        model.noteBlockRefs.splice(model.noteBlockRefs.indexOf(ref), 1);
      });
    });

    return { notes, blocks };
  }
}
