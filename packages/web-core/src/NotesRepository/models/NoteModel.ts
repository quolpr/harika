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
import { generateId } from '@harika/common';
import { NoteBlockModel, noteBlockRef } from './NoteBlockModel';
import { isVault } from './utils';
import type { VaultModel } from './VaultModel';
import { BlockContentModel } from './NoteBlockModel/BlockContentModel';
import { omit } from 'lodash-es';

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

const modelType = 'harika/NoteModel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNoteModel = (model: any): model is NoteModel =>
  '$modelType' in model && model.$modelType === modelType;

@model(modelType)
export class NoteModel extends Model({
  title: prop<string>(),
  dailyNoteDate: tProp(types.maybe(types.dateTimestamp)),
  createdAt: tProp(types.dateTimestamp),
  areChildrenLoaded: prop<boolean>(),
  areLinksLoaded: prop<boolean>(),
  areBacklinksLoaded: prop<boolean>(),
  isDeleted: prop<boolean>(false),
  rootBlockRef: prop<Ref<NoteBlockModel>>(),
}) {
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
      parentBlockRef: noteBlockRef(parent),
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
    parent: NoteBlockModel,
  ) {
    return new NoteBlockModel({
      $modelId: attrs.$modelId ? attrs.$modelId : generateId(),
      createdAt: new Date().getTime(),
      noteRef: noteRef(this),
      noteBlockRefs: [],
      parentBlockRef: noteBlockRef(parent),
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

  updateAttrs(attrs: ModelCreationData<NoteModel>) {
    if (!this.areLinksLoaded && attrs.areLinksLoaded) {
      this.areLinksLoaded = true;
    }

    if (!this.areChildrenLoaded && attrs.areChildrenLoaded) {
      this.areChildrenLoaded = true;
    }

    if (!this.areBacklinksLoaded && attrs.areBacklinksLoaded) {
      this.areBacklinksLoaded = true;
    }

    this.title = attrs.title;
    this.dailyNoteDate = attrs.dailyNoteDate;
    this.createdAt = attrs.createdAt;
    this.rootBlockRef = attrs.rootBlockRef;

    if (
      attrs.isDeleted !== undefined &&
      attrs.isDeleted !== null &&
      attrs.isDeleted !== this.isDeleted
    ) {
      this.isDeleted = attrs.isDeleted;
    }
  }

  areNeededDataLoaded(
    preloadChildren: boolean,
    preloadBacklinks: boolean,
    preloadBlockLinks: boolean,
  ) {
    return areNeededNoteDataLoaded(
      this,
      preloadChildren,
      preloadBacklinks,
      preloadBlockLinks,
    );
  }
}

export function areNeededNoteDataLoaded(
  data: {
    areChildrenLoaded: boolean | undefined;
    areLinksLoaded: boolean | undefined;
    areBacklinksLoaded: boolean | undefined;
  },
  preloadChildren: boolean,
  preloadBacklinks: boolean,
  preloadBlockLinks: boolean,
) {
  return (
    !(preloadChildren === true && data.areChildrenLoaded === false) &&
    !(preloadBlockLinks === true && data.areLinksLoaded === false) &&
    !(preloadBacklinks === true && data.areBacklinksLoaded === false)
  );
}
