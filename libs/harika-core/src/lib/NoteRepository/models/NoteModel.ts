import { comparer, computed } from 'mobx';
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
import { NoteBlockModel, noteBlockRef } from './NoteBlockModel';
import { isVault } from './utils';
import type { VaultModel } from './Vault';
import { isEqual } from 'lodash-es';

export const noteRef = customRef<NoteModel>('harika/NoteRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const vault = findParent<VaultModel>(this, isVault);

    if (!vault) return undefined;

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
  dailyNoteDate: tProp_dateTimestamp(types.dateTimestamp),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  noteBlockRefs: prop<Ref<NoteBlockModel>[]>(),
  areChildrenLoaded: prop<boolean>(false),
  areLinksLoaded: prop<boolean>(false),
  isDeleted: prop<boolean>(false),
}) {
  @computed
  get noteBlockIds() {
    return this.noteBlockRefs.map(({ id }) => id);
  }

  @computed
  // performance optimization
  get orderHash() {
    const obj: Record<string, number> = {};

    this.noteBlockRefs.forEach((ref, i) => {
      obj[ref.id] = i;
    });

    return obj;
  }

  @computed
  get vault() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return findParent<VaultModel>(this, isVault)!;
  }

  @computed({ equals: comparer.shallow })
  get noteBlockLinks() {
    return this.vault.noteLinks.filter(
      (link) => !link.isDeleted && link.noteRef.id === this.$modelId
    );
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
      'createdAt' | 'noteRef' | 'noteBlockRefs'
    >,
    parent: NoteBlockModel | NoteModel,
    pos: number
  ) {
    const newNoteBlock = new NoteBlockModel({
      $modelId: uuidv4(),
      createdAt: new Date(),
      noteRef: noteRef(this),
      noteBlockRefs: [],
      ...attrs,
    });

    this.vault.blocksMap[newNoteBlock.$modelId] = newNoteBlock;

    parent.noteBlockRefs.splice(pos, 0, noteBlockRef(newNoteBlock));

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
  delete(recursively = true, links = true) {
    this.isDeleted = true;

    if (recursively) {
      this.noteBlockRefs.forEach((block) => block.current.delete(true, links));
    }

    if (links) {
      this.noteBlockLinks.forEach((link) => link.delete());
    }
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

    if (
      attrs.noteBlockRefs &&
      !isEqual(
        attrs.noteBlockRefs.map(({ id }) => id),
        this.noteBlockIds
      )
    ) {
      this.noteBlockRefs = attrs.noteBlockRefs;
    }
  }
}
