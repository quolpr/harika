import { computed } from 'mobx';
import {
  customRef,
  detach,
  findParent,
  model,
  Model,
  modelAction,
  ModelInstanceCreationData,
  prop,
  Ref,
  tProp_dateTimestamp,
  types,
} from 'mobx-keystone';
import { Optional } from 'utility-types';
import { v4 as uuidv4 } from 'uuid';
import { Store } from '../Store';
import { NoteBlockModel, noteBlockRef } from './NoteBlockModel';
import isEqual from 'lodash.isequal';

export const noteRef = customRef<NoteModel>('harika/NoteRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const parent = findParent<Store>(ref, (n) => {
      return n instanceof Store;
    });

    if (!parent) return undefined;

    return parent.notesMap[ref.id];
  },
  onResolvedValueChange(ref, newTodo, oldTodo) {
    if (oldTodo && !newTodo) {
      // if the todo value we were referencing disappeared then remove the reference
      // from its parent
      detach(ref);
    }
  },
});

@model('harika/NoteModel')
export class NoteModel extends Model({
  title: prop<string>(''),
  dailyNoteDate: tProp_dateTimestamp(types.dateTimestamp),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  childBlockRefs: prop<Ref<NoteBlockModel>[]>(() => []),
  areChildrenLoaded: prop<boolean>(false),
  isPersisted: prop<boolean>(false),
  linkedNoteBlockRefs: prop<Ref<NoteBlockModel>[]>(() => []),
  areLinksLoaded: prop<boolean>(false),
  isDeleted: prop<boolean>(false),
}) {
  @computed
  get store() {
    return findParent<Store>(this, (n) => n instanceof Store) as Store;
  }

  @modelAction
  createBlock(
    attrs: Optional<
      ModelInstanceCreationData<NoteBlockModel>,
      'createdAt' | 'noteRef'
    >
  ) {
    const newNoteBlock = new NoteBlockModel({
      $modelId: uuidv4(),
      createdAt: new Date(),
      noteRef: noteRef(this),
      ...attrs,
    });

    this.store.blocksMap[newNoteBlock.$modelId] = newNoteBlock;

    return newNoteBlock;
  }

  @modelAction
  updateTitle(newTitle: string) {
    this.linkedNoteBlockRefs.forEach((noteBlock) => {
      noteBlock.current.content = noteBlock.current.content
        .split(`[[${this.title}]]`)
        .join(`[[${newTitle}]]`);
    });

    this.title = newTitle;
  }

  @modelAction
  setLoadedLinkedBlockIds(ids: string[]) {
    this.linkedNoteBlockRefs = ids.map((id) => noteBlockRef(id));

    this.areLinksLoaded = true;
  }

  @modelAction
  setLoadedChildrenNoteIds(ids: string[]) {
    this.childBlockRefs = ids.map((id) => noteBlockRef(id));

    this.areChildrenLoaded = true;
  }

  @modelAction
  destroy() {
    this.isDeleted = true;
  }

  @modelAction
  updateAttrs(attrs: ModelInstanceCreationData<NoteModel>) {
    if (!this.areLinksLoaded && attrs.areLinksLoaded) {
      this.areLinksLoaded = true;
    }

    if (
      attrs.areLinksLoaded &&
      attrs.linkedNoteBlockRefs &&
      !isEqual(
        attrs.linkedNoteBlockRefs?.map((ref) => ref.id).sort(),
        this.linkedNoteBlockRefs.map(({ id }) => id).sort()
      )
    ) {
      this.linkedNoteBlockRefs = attrs.linkedNoteBlockRefs;
    }

    if (!this.areChildrenLoaded && attrs.areChildrenLoaded) {
      this.areChildrenLoaded = true;
    }

    if (
      attrs.areChildrenLoaded &&
      attrs.childBlockRefs &&
      !isEqual(
        attrs.childBlockRefs?.map((ref) => ref.id).sort(),
        this.childBlockRefs.map(({ id }) => id).sort()
      )
    ) {
      this.childBlockRefs = attrs.childBlockRefs;
    }

    if (attrs.title && attrs.title !== this.title) {
      this.title = attrs.title;
    }

    if (attrs.dailyNoteDate && attrs.dailyNoteDate !== this.dailyNoteDate) {
      this.dailyNoteDate = attrs.dailyNoteDate;
    }

    if (attrs.createdAt && attrs.createdAt !== this.createdAt) {
      this.createdAt = attrs.createdAt;
    }

    if (attrs.isDeleted && attrs.isDeleted !== this.isDeleted) {
      this.isDeleted = attrs.isDeleted;
    }
  }
}
