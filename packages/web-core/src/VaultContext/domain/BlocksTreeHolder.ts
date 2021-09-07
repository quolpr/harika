import {
  customRef,
  detach,
  findParent,
  Model,
  model,
  modelAction,
  ModelCreationData,
  prop,
  transaction,
} from 'mobx-keystone';
import type { VaultModel } from './VaultModel';
import { isVault } from './utils';
import { computed } from 'mobx';
import type { Optional } from 'utility-types';
import { generateId } from '../../generateId';
import { omit } from 'lodash-es';
import { BlockContentModel } from './NoteBlockModel/BlockContentModel';
import { NoteBlockModel, noteBlockRef } from './NoteBlockModel';
import type { TreeToken } from '../../blockParser/parseStringToTree';
import { addTokensToNoteBlock } from '../../blockParser/blockUtils';
import type {
  BlocksViewModel,
  BlocksUIState,
} from './BlocksTreeView/BlocksTreeNodeModel';
import type { NoteModel } from './NoteModel';

export const treeHolderType = 'harika/BlocksTreeHolder';

export const blocksTreeHolderRef = customRef<BlocksTreeHolder>(
  'harika/BlocksTreeHolderRef',
  {
    // this works, but we will use getRefId() from the Todo class instead
    // getId(maybeTodo) {
    //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
    // },

    resolve(ref) {
      const vault = findParent<VaultModel>(this, isVault);

      if (!vault) {
        return undefined;
      }

      return vault.blocksTreeHoldersMap[ref.id];
    },

    onResolvedValueChange(ref, newTodo, oldTodo) {
      if (oldTodo && !newTodo) {
        // if the todo value we were referencing disappeared then remove the reference
        // from its parent
        detach(ref);
      }
    },
  },
);

@model(treeHolderType)
export class BlocksTreeHolder extends Model({
  blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
  noteId: prop<string>(),
}) {
  // TODO: optimize
  @computed
  get rootBlock(): NoteBlockModel | undefined {
    return Object.values(this.blocksMap).find((block) => block.isRoot)!;
  }

  // TODO: optimize
  @computed
  get childParentRelations() {
    const relations: Record<string, string> = {};

    Object.values(this.blocksMap).forEach((block) => {
      block.noteBlockRefs.forEach((childRef) => {
        relations[childRef.id] = block.$modelId;
      });
    });

    return relations;
  }
}

@model('@harika/NoteBlocksApp')
export class NoteBlocksApp extends Model({
  noteId: prop<string>(),
  blockTreeHolder: prop<BlocksTreeHolder>(),
  blockUIStates: prop<Record<string, BlocksUIState>>(),
}) {
  getView(note: NoteModel, model: { $modelId: string; $modelType: string }) {
    const key = `${note.$modelId}-${model.$modelType}-${model.$modelId}`;

    if (!this.blockUIStates[key]) return undefined;

    return this.blockUIStates[key];
  }

  getLinkedBlocksOfNoteId(noteId: string) {
    const linkedBlocks: NoteBlockModel[] = [];

    Object.values(this.blockTreeHolder.blocksMap).forEach((block) => {
      if (block.linkedNoteIds.includes(noteId)) {
        linkedBlocks.push(block);
      }
    });

    return linkedBlocks;
  }

  @modelAction
  createBlock(
    attrs: Optional<
      ModelCreationData<NoteBlockModel>,
      'createdAt' | 'noteId' | 'noteBlockRefs' | 'linkedNoteIds' | 'updatedAt'
    >,
    parent: NoteBlockModel,
    pos: number,
  ) {
    const newNoteBlock = new NoteBlockModel({
      $modelId: attrs.$modelId ? attrs.$modelId : generateId(),
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      noteId: this.noteId,
      noteBlockRefs: [],
      linkedNoteIds: [],
      ...omit(attrs, '$modelId'),
    });

    this.blockTreeHolder.blocksMap[newNoteBlock.$modelId] = newNoteBlock;

    parent.noteBlockRefs.splice(pos, 0, noteBlockRef(newNoteBlock));

    return newNoteBlock;
  }

  @modelAction
  buildBlock(
    attrs: Optional<
      ModelCreationData<NoteBlockModel>,
      'createdAt' | 'noteId' | 'noteBlockRefs' | 'linkedNoteIds'
    >,
  ) {
    return new NoteBlockModel({
      $modelId: attrs.$modelId ? attrs.$modelId : generateId(),
      createdAt: new Date().getTime(),
      noteId: this.noteId,
      noteBlockRefs: [],
      linkedNoteIds: [],
      ...omit(attrs, '$modelId'),
    });
  }

  @modelAction
  @transaction
  deleteNoteBlockIds(ids: string[]) {
    ids.forEach((id) => {
      this.blockTreeHolder.blocksMap[id].delete(false, true);
    });

    if (
      this.blockTreeHolder.rootBlock &&
      !this.blockTreeHolder.rootBlock?.hasChildren
    ) {
      this.createBlock(
        {
          content: new BlockContentModel({ value: '' }),
          isRoot: false,
          updatedAt: new Date().getTime(),
        },
        this.blockTreeHolder.rootBlock,
        0,
      );
    }
  }

  @modelAction
  addBlocks(blocks: NoteBlockModel[]) {
    blocks.forEach((block) => {
      this.blockTreeHolder.blocksMap[block.$modelId] = block;
    });
  }

  createOrUpdateBlock(
    attr: ModelCreationData<NoteBlockModel> & {
      $modelId: string;
    },
  ) {
    if (!this.blockTreeHolder.blocksMap[attr.$modelId]) {
      this.blockTreeHolder.blocksMap[attr.$modelId] = new NoteBlockModel(attr);
    } else {
      this.blockTreeHolder.blocksMap[attr.$modelId].updateAttrs(attr);
    }

    return this.blockTreeHolder.blocksMap[attr.$modelId];
  }
}
