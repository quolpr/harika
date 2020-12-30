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
import { NoteBlockModel } from './NoteBlockModel';
import isEqual from 'lodash.isequal';
import { Vault } from '../Vault';

export const noteRef = customRef<NoteModel>('harika/NoteRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const parent = findParent<Vault>(ref, (n) => {
      console.log(n);
      return n instanceof Object;
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
  areChildrenLoaded: prop<boolean>(false),
  isPersisted: prop<boolean>(false),
  linkedNoteBlockRefs: prop<Ref<NoteBlockModel>[]>(() => []),
  areLinksLoaded: prop<boolean>(false),
  isDeleted: prop<boolean>(false),
}) {
  @computed
  get store() {
    return findParent<Vault>(this, (n) => n instanceof Object) as Vault;
  }

  @computed
  get children() {
    return Object.values(this.store.blocksMap)
      .filter(
        (block) =>
          block.noteRef.id === this.$modelId &&
          block.parentBlockRef === undefined
      )
      .sort((a, b) => a.orderPosition - b.orderPosition);
  }

  @computed
  get allChildren() {
    return Object.values(this.store.blocksMap).filter(
      (block) => block.noteRef.id === this.$modelId
    );
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
