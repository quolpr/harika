import {
  Model,
  model,
  modelAction,
  onChildAttachedTo,
  prop,
  rootRef,
} from 'mobx-keystone';
import type { ModelCreationData } from 'mobx-keystone';
import {
  NoteBlockModel,
  noteBlockRef,
  parentBlockCtx,
  rootBlockIdCtx,
} from './NoteBlockModel';
import { comparer, computed } from 'mobx';
import type { Optional } from 'utility-types';
import { generateId } from '../../../../generateId';
import { omit } from 'lodash-es';
import { BlockContentModel } from './BlockContentModel';

export const blocksRegistryType = 'harika/BlockModelsRegistry';
export const blocksRegistryRef = rootRef<BlockModelsRegistry>(
  'harika/BlockModelsRegistryRef',
);

@model(blocksRegistryType)
export class BlockModelsRegistry extends Model({
  rootBlockId: prop<string>(),
  blocksMap: prop<Record<string, NoteBlockModel>>(() => ({})),
  noteId: prop<string>(),
}) {
  @computed
  get rootBlock(): NoteBlockModel | undefined {
    return this.blocksMap[this.rootBlockId];
  }

  registerNewBlock(block: NoteBlockModel) {
    this.blocksMap[block.$modelId] = block;
  }

  getBlockById(id: string) {
    return this.blocksMap[id];
  }

  getLinkedBlocksOfNoteId(noteId: string) {
    const linkedBlocks: NoteBlockModel[] = [];

    Object.values(this.blocksMap).forEach((block) => {
      if (block.linkedNoteIds.includes(noteId)) {
        linkedBlocks.push(block);
      }
    });

    return linkedBlocks;
  }

  // TODO: optimize
  @computed({ equals: comparer.shallow })
  get childParentRelations() {
    const relations: Record<string, string> = {};

    Object.values(this.blocksMap).forEach((block) => {
      block.noteBlockRefs.forEach((childRef) => {
        relations[childRef.id] = block.$modelId;
      });
    });

    return relations;
  }

  @modelAction
  createBlock(
    attrs: Optional<
      ModelCreationData<NoteBlockModel>,
      'createdAt' | 'noteId' | 'noteBlockRefs' | 'linkedNoteIds' | 'updatedAt'
    >,
    parent: NoteBlockModel,
    pos: number | 'append',
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

    this.registerNewBlock(newNoteBlock);

    if (pos === 'append') {
      parent.noteBlockRefs.push(noteBlockRef(newNoteBlock));
    } else {
      parent.noteBlockRefs.splice(pos, 0, noteBlockRef(newNoteBlock));
    }

    return newNoteBlock;
  }

  @modelAction
  deleteNoteBlockIds(ids: string[]) {
    ids.forEach((id) => {
      this.blocksMap[id].delete(false, true);
    });

    if (this.rootBlock && !this.rootBlock?.hasChildren) {
      this.createBlock(
        {
          content: new BlockContentModel({ _value: '' }),
          updatedAt: new Date().getTime(),
        },
        this.rootBlock,
        0,
      );
    }
  }

  createOrUpdateBlock(
    attr: ModelCreationData<NoteBlockModel> & {
      $modelId: string;
    },
  ) {
    if (!this.getBlockById(attr.$modelId)) {
      this.registerNewBlock(new NoteBlockModel(attr));
    } else {
      this.getBlockById(attr.$modelId).updateAttrs(attr);
    }

    return this.getBlockById(attr.$modelId);
  }

  onInit() {
    rootBlockIdCtx.setComputed(this, () => this.rootBlockId);

    onChildAttachedTo(
      () => this.blocksMap,
      (block) => {
        if (block instanceof NoteBlockModel) {
          parentBlockCtx.setComputed(block, () =>
            this.childParentRelations[block.$modelId]
              ? this.blocksMap[this.childParentRelations[block.$modelId]]
              : undefined,
          );
        }
      },
    );
  }
}
