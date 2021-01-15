import { comparer, computed } from 'mobx';
import {
  customRef,
  detach,
  getRoot,
  model,
  Model,
  modelAction,
  ModelInstanceCreationData,
  prop,
  tProp_dateTimestamp,
  types,
} from 'mobx-keystone';
import { Optional } from 'utility-types';
import { v4 as uuidv4 } from 'uuid';
import { NoteBlockModel } from './NoteBlockModel';
import { Vault } from '../Vault';

export const noteRef = customRef<NoteModel>('harika/NoteRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const vault = getRoot<Vault>(ref);

    if (!vault || vault.$modelType !== 'harika/Vault') return undefined;

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

@model('harika/NoteModel')
export class NoteModel extends Model({
  title: prop<string>(),
  dailyNoteDate: tProp_dateTimestamp(types.dateTimestamp),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  areChildrenLoaded: prop<boolean>(false),
  areLinksLoaded: prop<boolean>(false),
  isDeleted: prop<boolean>(false),
}) {
  @computed
  get vault() {
    return getRoot<Vault>(this);
  }

  @computed({ equals: comparer.shallow })
  get noteBlockLinks() {
    return this.vault.noteLinks.filter(
      (link) => link.noteRef.id === this.$modelId
    );
  }

  @computed({ equals: comparer.shallow })
  get children() {
    return Object.values(this.vault.blocksMap)
      .filter(
        (block) =>
          block.noteRef.id === this.$modelId &&
          block.parentBlockRef === undefined &&
          !block.isDeleted
      )
      .sort((a, b) => a.orderPosition - b.orderPosition);
  }

  @computed({ equals: comparer.shallow })
  get allChildren() {
    return Object.values(this.vault.blocksMap).filter(
      (block) => block.noteRef.id === this.$modelId && !block.isDeleted
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

    this.vault.blocksMap[newNoteBlock.$modelId] = newNoteBlock;

    return newNoteBlock;
  }

  @modelAction
  updateTitle(newTitle: string) {
    this.noteBlockLinks.forEach((link) => {
      link.noteBlockRef.current.content = link.noteBlockRef.current.content
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
