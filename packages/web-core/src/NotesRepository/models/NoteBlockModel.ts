import {
  findParent,
  model,
  Model,
  modelAction,
  ModelCreationData,
  prop,
  Ref,
  rootRef,
  tProp,
  types,
} from 'mobx-keystone';
import { comparer, computed } from 'mobx';
import { NoteModel, noteRef } from './NoteModel';
import type { BlocksViewModel } from './BlocksViewModel';
import type { VaultModel } from './VaultModel';
import { isVault } from './utils';
import { isEqual } from 'lodash-es';
import { BlockContentModel } from './BlockContentModel';

export const noteBlockRef = rootRef<NoteBlockModel>('harika/NoteBlockRef');

@model('harika/NoteBlockModel')
export class NoteBlockModel extends Model({
  parentBlockRef: prop<Ref<NoteBlockModel> | undefined>(),
  noteRef: prop<Ref<NoteModel>>(),
  content: prop<BlockContentModel>(),
  noteBlockRefs: prop<Ref<NoteBlockModel>[]>(),
  linkedNoteRefs: prop<Ref<NoteModel>[]>(),
  createdAt: tProp(types.dateTimestamp),
  isDeleted: prop<boolean>(false),
}) {
  @computed
  get isRoot() {
    return this.parentBlockRef === undefined;
  }

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
  get orderPosition() {
    return this.parentBlockRef
      ? this.parentBlockRef.current.orderHash[this.$modelId]
      : 0;
  }

  @computed
  get hasChildren() {
    return this.noteBlockRefs.length !== 0;
  }

  @computed({ equals: comparer.shallow })
  get path() {
    let current: NoteBlockModel | undefined = this.parentBlockRef?.current;
    const path: NoteBlockModel[] = [];

    while (current) {
      if (current.isRoot) break;

      path.unshift(current);
      current = current.parentBlockRef?.current;
    }

    return path;
  }

  @computed
  get vault() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return findParent<VaultModel>(this, isVault)!;
  }

  @computed({ equals: comparer.shallow })
  get siblings() {
    if (!this.parentBlockRef) {
      throw new Error("You can't get sibling of root noteblock");
    }

    return this.parentBlockRef.current.noteBlockRefs;
  }

  @computed({ equals: comparer.shallow })
  get leftAndRightSibling(): [
    left: NoteBlockModel | undefined,
    right: NoteBlockModel | undefined,
  ] {
    const siblings = this.siblings;

    const index = siblings.findIndex(
      (nb) => this.$modelId === nb.current.$modelId,
    );

    return [
      siblings.length === 0 ? undefined : siblings[index - 1]?.current,
      index + 1 < siblings.length ? siblings[index + 1]?.current : undefined,
    ];
  }

  @computed
  get deepLastRightChild(): NoteBlockModel {
    if (this.noteBlockRefs.length === 0) return this;

    return this.noteBlockRefs[this.noteBlockRefs.length - 1].current
      .deepLastRightChild;
  }

  @computed
  get nearestRightToParent(): NoteBlockModel | undefined {
    if (!this.parentBlockRef || this.parentBlockRef.current.isRoot)
      return undefined;

    const [, right] = this.parentBlockRef.current.leftAndRightSibling;

    if (right) return right;

    return this.parentBlockRef.current.nearestRightToParent;
  }

  @computed({ equals: comparer.shallow })
  get leftAndRight(): [
    left: NoteBlockModel | undefined,
    right: NoteBlockModel | undefined,
  ] {
    let [left, right] = this.leftAndRightSibling;

    if (left) {
      left = left.deepLastRightChild;
    }

    if (
      !left &&
      this.parentBlockRef !== undefined &&
      !this.parentBlockRef.current.isRoot
    ) {
      left = this.parentBlockRef.current;
    }

    const children = this.noteBlockRefs;

    if (children.length !== 0 && children[0]) {
      right = children[0].current;
    }

    if (!right) {
      right = this.nearestRightToParent;
    }

    return [left, right];
  }

  @computed({ equals: comparer.shallow })
  get allRightSiblings() {
    const siblings = this.siblings;
    const index = this.orderPosition;

    return siblings.slice(index + 1);
  }

  @modelAction
  move(parent: NoteBlockModel, pos: number | 'start' | 'end') {
    if (!this.parentBlockRef) {
      throw new Error("Can't move root block");
    }

    this.parentBlockRef.current.noteBlockRefs.splice(this.orderPosition, 1);

    if (parent !== this.parentBlockRef.current) {
      this.parentBlockRef = noteBlockRef(parent);
    }

    const newPos = (() => {
      if (pos === 'start') {
        return 0;
      } else if (pos === 'end') {
        return this.parentBlockRef.current.noteBlockRefs.length;
      } else {
        return pos;
      }
    })();

    this.parentBlockRef.current.noteBlockRefs.splice(
      newPos,
      0,
      noteBlockRef(this),
    );
  }

  @modelAction
  mergeToLeftAndDelete() {
    const [left] = this.leftAndRight;

    if (!left) return;

    left.content.update(left.content.value + this.content.value);

    this.noteBlockRefs.forEach((ch) => {
      ch.current.parentBlockRef = noteBlockRef(left);
    });

    left.noteBlockRefs.push(
      ...this.noteBlockRefs.map((r) => noteBlockRef(r.id)),
    );

    left.linkedNoteRefs.push(...this.linkedNoteRefs.map((r) => noteRef(r.id)));

    this.delete(false, false);

    return left;
  }

  @modelAction
  injectNewRightBlock(content: string, view: BlocksViewModel) {
    if (!this.parentBlockRef) {
      throw new Error("Can't inject from root block");
    }

    const { injectTo, parentRef, parent } = (() => {
      if (this.noteBlockRefs.length && view.isExpanded(this.$modelId)) {
        return {
          injectTo: 0,
          parent: this,
          parentRef: noteBlockRef(this),
        };
      } else {
        return {
          injectTo: this.orderPosition + 1,
          parent: this.parentBlockRef.current,
          parentRef: noteBlockRef(this.parentBlockRef.current),
        };
      }
    })();

    const newNoteBlock = this.noteRef.current.createBlock(
      {
        parentBlockRef: parentRef,
        content: new BlockContentModel({ value: content }),
      },
      parent,
      injectTo,
    );

    return newNoteBlock;
  }

  @modelAction
  tryMoveLeft() {
    if (!this.parentBlockRef) {
      throw new Error("Can't move root block");
    }

    const [left] = this.leftAndRight;

    if (!left) return;

    if (!left.parentBlockRef) {
      throw new Error("Left couldn't be root block");
    }

    if (left === this.parentBlockRef?.current) {
      // If left block is parent

      this.move(left.parentBlockRef?.current, left.orderPosition);
    } else if (left.parentBlockRef?.current !== this.parentBlockRef?.current) {
      // If left is child of child of child...

      this.move(left.parentBlockRef?.current, left.orderPosition + 1);
    } else {
      // if same level

      this.move(this.parentBlockRef?.current, left.orderPosition);
    }
  }

  @modelAction
  tryMoveRight() {
    let [, right] = this.leftAndRightSibling;

    if (!right) {
      right = this.nearestRightToParent;
    }

    if (!right) return;

    if (!right.parentBlockRef) {
      throw new Error("Right couldn't be root block");
    }

    if (right.noteBlockRefs.length) {
      this.move(right, 'start');
    } else {
      this.move(right.parentBlockRef?.current, right.orderPosition);
    }
  }

  @modelAction
  tryMoveUp() {
    const [left] = this.leftAndRightSibling;

    if (left) {
      this.move(left, 'end');
    }
  }

  @modelAction
  tryMoveDown() {
    const parentRef = this.parentBlockRef;
    const parentOfParentRef = parentRef?.current?.parentBlockRef;

    if (!parentRef || !parentOfParentRef) return;

    this.move(parentOfParentRef?.current, parentRef.current.orderPosition + 1);
  }

  updateAttrs(data: ModelCreationData<NoteBlockModel>) {
    if (
      data.content !== undefined &&
      data.content !== null &&
      data.content.value !== this.$.content.value
    ) {
      this.content = data.content;
    }

    if (data.noteRef && data.noteRef.id !== this.$.noteRef.id) {
      this.noteRef = data.noteRef;
    }

    if (data.createdAt && data.createdAt !== this.createdAt) {
      this.createdAt = data.createdAt;
    }

    if (data.parentBlockRef?.id !== this.parentBlockRef?.id) {
      this.parentBlockRef = data.parentBlockRef;
    }

    if (
      data.noteBlockRefs &&
      !isEqual(
        data.noteBlockRefs.map(({ id }) => id),
        this.noteBlockIds,
      )
    ) {
      this.noteBlockRefs = data.noteBlockRefs;
    }

    if (
      data.linkedNoteRefs &&
      !isEqual(
        data.linkedNoteRefs.map(({ id }) => id),
        this.linkedNoteRefs,
      )
    ) {
      this.linkedNoteRefs = data.linkedNoteRefs;
    }
  }

  @modelAction
  delete(recursively = true, links = true) {
    if (recursively) {
      this.noteBlockRefs.forEach((block) => block.current.delete(true, links));
    }

    if (this.parentBlockRef) {
      this.parentBlockRef.current.noteBlockRefs.splice(this.orderPosition, 1);

      this.parentBlockRef = undefined;
    }

    this.isDeleted = true;
  }

  @modelAction
  updateLinks(allNoteIds: string[]) {
    this.linkedNoteRefs.forEach((ref, index) => {
      const note = ref.maybeCurrent;

      if (!note || !allNoteIds.includes(ref.id)) {
        this.linkedNoteRefs.splice(index, 1);
      }
    });

    const currentLinkedNoteIds = this.linkedNoteRefs.map(({ id }) => id);
    allNoteIds.forEach((noteId) => {
      if (!currentLinkedNoteIds.includes(noteId)) {
        this.linkedNoteRefs.push(noteRef(noteId));
      }
    });
  }
}
