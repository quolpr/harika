import {
  Model,
  model,
  modelAction,
  ModelCreationData,
  prop,
  transaction,
} from 'mobx-keystone';
import { NoteModel } from './NoteModel';
import type { Optional, Required } from 'utility-types';
import { vaultModelType } from './consts';
import { generateId } from '../../generateId';
import { BlockContentModel } from './NoteBlockModel/BlockContentModel';
import { VaultUiState } from './VaultUiState';
import {
  newTreeModel,
  NotesTreeModel,
  PartialNote,
} from './NotesTree/NotesTreeModel';
import { BlocksTreeHolder, NoteBlockModel } from './NoteBlockModel';

@model(vaultModelType)
export class VaultModel extends Model({
  name: prop<string>(),
  notesMap: prop<Record<string, NoteModel>>(() => ({})),
  // Key is noteId
  blocksTreeHoldersMap: prop<Record<string, BlocksTreeHolder>>(() => ({})),
  ui: prop<VaultUiState>(() => new VaultUiState({})),
  notesTree: prop<NotesTreeModel>(() => newTreeModel()),
}) {
  getNoteBlock(blockId: string) {
    for (const treeHolder of Object.values(this.blocksTreeHoldersMap)) {
      const block = treeHolder.blocksMap[blockId];

      if (block) return block;
    }

    return undefined;
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
        'createdAt' | 'dailyNoteDate' | 'rootBlockId'
      >,
      'title'
    >,
    options?: { addEmptyBlock?: boolean; isDaily?: boolean },
  ) {
    options = { addEmptyBlock: true, ...options };

    const noteId = generateId();

    const rootBlock = new NoteBlockModel({
      $modelId: generateId(),
      createdAt: new Date().getTime(),
      noteId: noteId,
      noteBlockRefs: [],
      content: new BlockContentModel({ value: '' }),
      linkedNoteIds: [],
    });

    const note = new NoteModel({
      $modelId: noteId,
      createdAt: new Date().getTime(),
      rootBlockId: rootBlock.$modelId,
      ...(options.isDaily
        ? {
            dailyNoteDate: new Date().getTime(),
          }
        : {}),
      ...attrs,
    });

    this.notesMap[note.$modelId] = note;

    const treeHolder = new BlocksTreeHolder({
      blocksMap: { [rootBlock.$modelId]: rootBlock },
      noteId: noteId,
    });
    this.blocksTreeHoldersMap[treeHolder.noteId] = treeHolder;

    if (options.addEmptyBlock) {
      treeHolder.createBlock(
        { content: new BlockContentModel({ value: '' }) },
        rootBlock,
        0,
      );
    }

    return { note, treeHolder };
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

    blocksAttrs.map((attr) => {
      if (!this.blocksTreeHoldersMap[attr.noteId]) {
        this.blocksTreeHoldersMap[attr.noteId] = new BlocksTreeHolder({
          noteId: attr.noteId,
        });
      }

      return this.blocksTreeHoldersMap[attr.noteId].createOrUpdateBlock(attr);
    });

    // blocks.forEach((model) => {
    //   if (!model) return;

    //   const toRemoveRefs = model.noteBlockRefs
    //     .map((ref) => {
    //       if (!this.blocksTreeHoldersMap[model.noteId].blocksMap[ref.id]) {
    //         return ref;
    //       }

    //       return false;
    //     })
    //     .filter(Boolean) as Ref<NoteBlockModel>[];

    //   toRemoveRefs.forEach((ref) => {
    //     console.error(
    //       'removing noteblock ref cause noteblock was not found',
    //       ref.id,
    //       JSON.stringify(model.$),
    //     );

    //     model.noteBlockRefs.splice(model.noteBlockRefs.indexOf(ref), 1);
    //   });
    // });
  }
}
