import {
  Model,
  model,
  modelAction,
  ModelCreationData,
  prop,
  Ref,
  transaction,
} from 'mobx-keystone';
import { NoteModel, noteRef } from './NoteModel';
import type { Optional, Required } from 'utility-types';
import { NoteBlockModel, noteBlockRef } from './NoteBlockModel';
import { vaultModelType } from './consts';
import { generateId } from '@harika/common';
import { BlockContentModel } from './NoteBlockModel/BlockContentModel';
import { VaultUiState } from './VaultUiState';
import { merge } from 'lodash-es';

@model(vaultModelType)
export class VaultModel extends Model({
  name: prop<string>(),
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
  blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
  ui: prop<VaultUiState>(() => new VaultUiState({})),
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
  @transaction
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

    // NOTE

    const toUpdateNotes = noteAttrs.filter(
      (note) => this.notesMap[note.$modelId],
    );

    // Let's create new blocks at first
    this.notesMap = {
      ...this.notesMap,
      ...Object.fromEntries(
        noteAttrs
          .filter((note) => !this.notesMap[note.$modelId])
          .map((note) => [note.$modelId, new NoteModel(note)]),
      ),
    };

    toUpdateNotes.forEach((note) => {
      this.notesMap[note.$modelId].updateAttrs(note);
    });

    // BLOCK

    const toUpdateBlocks = blocksAttrs.filter(
      (block) => this.blocksMap[block.$modelId],
    );

    // Let's create new blocks at first
    this.blocksMap = {
      ...this.blocksMap,
      ...Object.fromEntries(
        blocksAttrs
          .filter((block) => !this.blocksMap[block.$modelId])
          .map((block) => [block.$modelId, new NoteBlockModel(block)]),
      ),
    };

    toUpdateBlocks.forEach((block) => {
      this.blocksMap[block.$modelId].updateAttrs(block);
    });

    // blocks.forEach((model) => {
    //   const toRemoveRefs = model.noteBlockRefs
    //     .map((ref, i) => {
    //       if (!this.blocksMap[ref.id]) {
    //         return ref;
    //       }

    //       return false;
    //     })
    //     .filter(Boolean) as Ref<NoteBlockModel>[];

    //   toRemoveRefs.forEach((ref) => {
    //     console.error(
    //       'removing noteblock ref cause noteblock was not found',
    //       ref.id,
    //       JSON.stringify(model.noteBlockRefs.indexOf(ref)),
    //     );

    //     model.noteBlockRefs.splice(model.noteBlockRefs.indexOf(ref), 1);
    //   });
    // });
  }
}
