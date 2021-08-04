import { comparer, computed } from 'mobx';
import {
  customRef,
  detach,
  findParent,
  model,
  Model,
  modelAction,
  ModelCreationData,
  prop,
  Ref,
  tProp,
  transaction,
  types,
} from 'mobx-keystone';
import type { Optional } from 'utility-types';
import { generateId } from '../../generateId';
import { NoteBlockModel, noteBlockRef } from './NoteBlockModel';
import { isVault } from './utils';
import type { VaultModel } from './VaultModel';
import { BlockContentModel } from './NoteBlockModel/BlockContentModel';
import { omit } from 'lodash-es';
import type { ToPreloadInfo } from '../persistence/NoteLoader';

export interface INoteLoadStatus {
  areBlockLinksLoaded: boolean;
  areChildrenLoaded: boolean;
  areNoteLinksLoaded: boolean;
}

export const noteRef = customRef<NoteModel>('harika/NoteRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const vault = findParent<VaultModel>(this, isVault);

    if (!vault) {
      return undefined;
    }

    return vault.notesMap[ref.id];
  },

  onResolvedValueChange(ref, newTodo, oldTodo) {
    if (oldTodo && !newTodo) {
      // if the todo value we were referencing disappeared then remove the reference
      // from its parent
      detach(ref);
    }
  },
});

const modelType = 'harika/NoteModel' as const;

export const generateRootBlockId = (noteId: string) => `${noteId}-rootBlock`;
export const generateConflictedRootBlockId = (noteId: string) =>
  `${noteId}-conflictedRootBlock`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNoteModel = (model: any): model is NoteModel =>
  '$modelType' in model && model.$modelType === modelType;

@model(modelType)
export class NoteModel extends Model({
  title: prop<string>(),
  dailyNoteDate: tProp(types.maybe(types.dateTimestamp)),
  createdAt: tProp(types.dateTimestamp),
  areChildrenLoaded: prop<boolean>(),
  areBlockLinksLoaded: prop<boolean>(),
  areNoteLinksLoaded: prop<boolean>(),
  isDeleted: prop<boolean>(false),
  rootBlockRef: prop<Ref<NoteBlockModel>>(),
}) {
  get loadStatus(): INoteLoadStatus {
    return {
      areBlockLinksLoaded: this.areBlockLinksLoaded,
      areChildrenLoaded: this.areChildrenLoaded,
      areNoteLinksLoaded: this.areNoteLinksLoaded,
    };
  }

  @computed
  get childParentRelations() {
    const relations: Record<string, string> = {};

    Object.values(this.vault.blocksMap).forEach((block) => {
      if (block.noteRef.id === this.$modelId) {
        block.noteBlockRefs.forEach((childRef) => {
          relations[childRef.id] = block.$modelId;
        });
      }
    });

    return relations;
  }

  @computed
  get vault() {
    return findParent<VaultModel>(this, isVault)!;
  }

  @modelAction
  @transaction
  deleteNoteBlockIds(ids: string[]) {
    ids.forEach((id) => {
      this.vault.blocksMap[id].delete(false, true);
    });

    if (!this.rootBlockRef.current.hasChildren) {
      this.createBlock(
        { content: new BlockContentModel({ value: '' }) },
        this.rootBlockRef.current,
        0,
      );
    }
  }

  @computed({ equals: comparer.shallow })
  get linkedBlocks() {
    // TODO: optimize
    return Object.values(this.vault.blocksMap).filter((block) => {
      return Boolean(
        !block.isDeleted &&
          block.linkedNoteRefs.find((ref) => ref.id === this.$modelId),
      );
    });
  }

  @modelAction
  createBlock(
    attrs: Optional<
      ModelCreationData<NoteBlockModel>,
      'createdAt' | 'noteRef' | 'noteBlockRefs' | 'linkedNoteRefs'
    >,
    parent: NoteBlockModel,
    pos: number,
  ) {
    const newNoteBlock = new NoteBlockModel({
      $modelId: attrs.$modelId ? attrs.$modelId : generateId(),
      createdAt: new Date().getTime(),
      noteRef: noteRef(this),
      noteBlockRefs: [],
      linkedNoteRefs: [],
      ...omit(attrs, '$modelId'),
    });

    this.vault.blocksMap[newNoteBlock.$modelId] = newNoteBlock;

    parent.noteBlockRefs.splice(pos, 0, noteBlockRef(newNoteBlock));

    return newNoteBlock;
  }

  @modelAction
  buildBlock(
    attrs: Optional<
      ModelCreationData<NoteBlockModel>,
      'createdAt' | 'noteRef' | 'noteBlockRefs' | 'linkedNoteRefs'
    >,
  ) {
    return new NoteBlockModel({
      $modelId: attrs.$modelId ? attrs.$modelId : generateId(),
      createdAt: new Date().getTime(),
      noteRef: noteRef(this),
      noteBlockRefs: [],
      linkedNoteRefs: [],
      ...omit(attrs, '$modelId'),
    });
  }

  @modelAction
  updateTitle(newTitle: string) {
    this.linkedBlocks.forEach((block) => {
      block.content.updateTitle(this.title, newTitle);
    });

    this.title = newTitle;
  }

  @modelAction
  delete(recursively = true, links = true) {
    this.isDeleted = true;

    if (recursively) {
      this.rootBlockRef.current.delete(true, links);
    }
  }

  @modelAction
  updateAttrs(attrs: ModelCreationData<NoteModel>) {
    if (!this.areBlockLinksLoaded && attrs.areBlockLinksLoaded) {
      this.areBlockLinksLoaded = true;
    }

    if (!this.areChildrenLoaded && attrs.areChildrenLoaded) {
      this.areChildrenLoaded = true;
    }

    if (!this.areNoteLinksLoaded && attrs.areNoteLinksLoaded) {
      this.areNoteLinksLoaded = true;
    }

    this.title = attrs.title;
    this.dailyNoteDate = attrs.dailyNoteDate;
    this.createdAt = attrs.createdAt;

    if (this.rootBlockRef.id !== attrs.rootBlockRef.id) {
      this.rootBlockRef = attrs.rootBlockRef;
    }

    if (
      attrs.isDeleted !== undefined &&
      attrs.isDeleted !== null &&
      attrs.isDeleted !== this.isDeleted
    ) {
      this.isDeleted = attrs.isDeleted;
    }
  }

  areNeededDataLoaded(toPreloadInfo: ToPreloadInfo) {
    return areNeededNoteDataLoaded(this, toPreloadInfo);
  }
}

export function areNeededNoteDataLoaded(
  data: INoteLoadStatus,
  { preloadChildren, preloadNoteLinks, preloadBlockLinks }: ToPreloadInfo,
) {
  return (
    !(preloadChildren === true && data.areChildrenLoaded === false) &&
    !(preloadBlockLinks === true && data.areBlockLinksLoaded === false) &&
    !(preloadNoteLinks === true && data.areNoteLinksLoaded === false)
  );
}
