import { Model, model, modelAction, prop, transaction } from 'mobx-keystone';
import type { ModelCreationData } from 'mobx-keystone';
import { NoteModel } from './NoteModel';
import type { Optional, Required } from 'utility-types';
import { vaultModelType } from './consts';
import { generateId } from '../../generateId';
import { newTreeModel, NotesTreeModel } from './NotesTree/NotesTreeModel';
import type { PartialNote } from './NotesTree/NotesTreeModel';
import type { NoteBlockModel } from './NoteBlocksApp/NoteBlockModel';
import dayjs from 'dayjs';
import { NoteBlocksApp } from './NoteBlocksApp/NoteBlocksApp';
import { computed } from 'mobx';

@model(vaultModelType)
export class VaultModel extends Model({
  name: prop<string>(),
  // TODO: notes registry
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
  // Key is noteId
  noteBlocksApp: prop<NoteBlocksApp>(() => new NoteBlocksApp({})),
  notesTree: prop<NotesTreeModel>(() => newTreeModel()),
}) {
  @computed
  get noteRootBlockIdsMap() {
    return Object.fromEntries(
      Object.values(this.notesMap).map((note) => [
        note.$modelId,
        note.rootBlockId,
      ]),
    );
  }

  areBlocksOfNoteLoaded(noteId: string) {
    return this.noteBlocksApp.areBlocksOfNoteLoaded(noteId);
  }

  getNoteBlock(id: string) {
    return this.noteBlocksApp.getNoteBlock(id);
  }

  @modelAction
  initializeNotesTree(partialNotes: PartialNote[]) {
    this.notesTree.initializeTree(partialNotes);
  }

  @modelAction
  newNote(
    attrs: Required<
      Optional<
        ModelCreationData<NoteModel>,
        'createdAt' | 'dailyNoteDate' | 'updatedAt' | 'rootBlockId'
      >,
      'title'
    >,
    options?: { addEmptyBlock?: boolean; isDaily?: boolean },
  ) {
    options = { addEmptyBlock: true, ...options };

    const noteId = generateId();

    const { registry, rootBlock } = this.noteBlocksApp.createNewRegistry(
      noteId,
      options,
    );

    const note = new NoteModel({
      $modelId: noteId,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      rootBlockId: rootBlock.$modelId,
      ...(options.isDaily
        ? {
            dailyNoteDate: dayjs().startOf('day').unix(),
          }
        : {}),
      ...attrs,
    });

    this.notesMap[note.$modelId] = note;

    return { note, treeRegistry: registry };
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
    createBlocksRegistry: boolean,
  ) {
    // console.debug(
    //   'createOrUpdateEntitiesFromAttrs, notes: ',
    //   JSON.stringify(
    //     {
    //       noteAttrs: noteAttrs.map(
    //         ({
    //           $modelId,
    //           title,
    //           areNoteLinksLoaded: areBacklinksLoaded,
    //           areChildrenLoaded,
    //           areBlockLinksLoaded: areLinksLoaded,
    //         }) => ({
    //           $modelId,
    //           title,
    //           areBacklinksLoaded,
    //           areChildrenLoaded,
    //           areLinksLoaded,
    //         }),
    //       ),
    //       blocksAttrs: blocksAttrs,
    //     },
    //     null,
    //     2,
    //   ),
    // );
    // NOTE

    noteAttrs.forEach((attr) => {
      if (!this.notesMap[attr.$modelId]) {
        this.notesMap[attr.$modelId] = new NoteModel(attr);
      } else {
        this.notesMap[attr.$modelId].updateAttrs(attr);
      }
    });

    // // BLOCK

    this.noteBlocksApp.createOrUpdateEntitiesFromAttrs(
      blocksAttrs,
      this.noteRootBlockIdsMap,
      createBlocksRegistry,
    );
  }
}
