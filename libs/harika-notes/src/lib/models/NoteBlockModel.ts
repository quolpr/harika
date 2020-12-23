import {
  customRef,
  detach,
  findParent,
  model,
  Model,
  modelAction,
  prop,
  Ref,
  tProp_dateTimestamp,
  types,
} from 'mobx-keystone';
import { computed } from 'mobx';
import { NoteModel, noteRef } from './NoteModel';
import { Store } from '../Store';
import { NoteLinkModel } from './NoteLinkModel';

// TODO maybe root ref? What is the best way to manage??
export const noteBlockRef = customRef<NoteBlockModel>('harika/NoteBlockRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const parent = findParent<Store>(ref, (n) => {
      return n instanceof Store;
    });

    if (!parent) return undefined;

    return parent.blocksMap[ref.id];
  },
  onResolvedValueChange(ref, newTodo, oldTodo) {
    if (oldTodo && !newTodo) {
      // if the todo value we were referencing disappeared then remove the reference
      // from its parent
      detach(ref);
    }
  },
});

@model('harika/NoteBlockModel')
export class NoteBlockModel extends Model({
  childBlockRefs: prop<Ref<NoteBlockModel>[]>(() => []),
  parentBlockRef: prop<Ref<NoteBlockModel> | undefined>(),
  noteRef: prop<Ref<NoteModel>>(),
  content: prop<string>(),
  updatedAt: tProp_dateTimestamp(types.dateTimestamp),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  isDeleted: prop<boolean>(false),
  isPersisted: prop<boolean>(false),
  linkedNotes: prop<Ref<NoteModel>[]>(() => []),
}) {
  @computed
  get parentChildRefs() {
    if (!this.parentBlockRef) {
      return this.noteRef.current.childBlockRefs;
    }

    return this.parentBlockRef.current.childBlockRefs;
  }

  @computed
  get orderPosition() {
    const siblings = this.allSiblings;

    return siblings.indexOf(this);
  }

  @computed
  get allSiblings() {
    return this.parentChildRefs.map(({ current }) => current);
  }

  @computed
  get leftAndRightSibling(): [
    left: NoteBlockModel | undefined,
    right: NoteBlockModel | undefined
  ] {
    const siblings = this.allSiblings;
    const index = this.orderPosition;

    return [siblings[index - 1], siblings[index + 1]];
  }

  @computed
  get deepLastRightChild(): NoteBlockModel {
    if (this.childBlockRefs.length === 0) return this;

    return this.childBlockRefs[this.childBlockRefs.length - 1].current
      .deepLastRightChild;
  }

  @computed
  get nearestRightToParent(): NoteBlockModel | undefined {
    if (!this.parentBlockRef) return;

    const [, right] = this.parentBlockRef.current.leftAndRightSibling;

    if (right) return right;

    return this.parentBlockRef.current.nearestRightToParent;
  }

  @computed
  get leftAndRight(): [
    left: NoteBlockModel | undefined,
    right: NoteBlockModel | undefined
  ] {
    let [left, right] = this.leftAndRightSibling;

    if (left) {
      left = left.deepLastRightChild;
    }

    if (!left) {
      left = this.parentBlockRef?.current;
    }

    const children = this.childBlockRefs.map(({ current }) => current);

    if (children[0]) {
      right = children[0];
    }

    if (!right) {
      right = this.nearestRightToParent;
    }

    return [left, right];
  }

  @computed
  get allRightSiblings() {
    const siblings = this.allSiblings;
    const index = this.orderPosition;

    // TODO: check that works correctly
    return siblings.slice(index + 1);
  }

  @modelAction
  move(parent: undefined | NoteBlockModel, pos: number | 'start' | 'end') {
    const [removedChild] = this.removeSelfFromParentChild();

    if (parent !== this.parentBlockRef?.current) {
      this.parentBlockRef = parent ? noteBlockRef(parent) : undefined;
    }

    const childBlockRefs = (() => {
      if (parent) {
        return parent.childBlockRefs;
      } else {
        return this.noteRef.current.childBlockRefs;
      }
    })();

    const newPos = (() => {
      if (pos === 'start') {
        return 0;
      } else if (pos === 'end') {
        return childBlockRefs.length;
      } else {
        return pos;
      }
    })();

    childBlockRefs.splice(newPos, 0, removedChild);
  }

  @modelAction
  removeSelfFromParentChild() {
    return this.parentChildRefs.splice(this.orderPosition, 1);
  }

  @modelAction
  mergeToLeftAndDelete() {
    const [left] = this.leftAndRight;

    if (!left) return;

    this.removeSelfFromParentChild();

    left.content = left.content + this.content;

    left.childBlockRefs.push(
      ...this.childBlockRefs.map(({ current }) => noteBlockRef(current))
    );

    this.childBlockRefs.forEach(({ current: ch }) => {
      ch.parentBlockRef = noteBlockRef(left);
    });

    this.isDeleted = true;
    this.parentBlockRef = undefined;

    return left;
  }

  @modelAction
  injectNewRightBlock(content: string) {
    const { injectTo, parentRef, list } = (() => {
      if (this.childBlockRefs.length) {
        return {
          injectTo: 0,
          parentRef: noteBlockRef(this),
          list: this.childBlockRefs,
        };
      } else {
        return {
          injectTo: this.orderPosition + 1,
          parentRef: this.parentBlockRef
            ? noteBlockRef(this.parentBlockRef.current)
            : undefined,
          list: this.parentChildRefs,
        };
      }
    })();

    const newNoteBlock = this.noteRef.current.createBlock({
      childBlockRefs: [],
      parentBlockRef: parentRef,
      content: content,
    });

    list.splice(injectTo, 0, noteBlockRef(newNoteBlock));

    return newNoteBlock;
  }

  @modelAction
  tryMoveLeft() {
    const [left] = this.leftAndRight;

    if (!left) return;

    if (left === this.parentBlockRef?.current) {
      // If left block is parent

      this.move(left.parentBlockRef?.current, left.orderPosition);
    } else if (left.parentBlockRef?.current !== this.parentBlockRef?.current) {
      // If left is child of child of child...

      this.move(left.parentBlockRef?.current, left.orderPosition + 1);
    } else {
      // if same level

      this.move(this.parentBlockRef?.current, this.orderPosition - 1);
    }
  }

  @modelAction
  tryMoveRight() {
    const [, right] = this.leftAndRight;

    if (!right) return;

    if (right.childBlockRefs.length) {
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

    if (
      (parentOfParentRef === undefined && parentRef === undefined) ||
      !parentRef
    )
      return;

    this.move(parentOfParentRef?.current, parentRef.current.orderPosition + 1);
  }

  @modelAction
  updateContent(content: string) {
    this.content = content;
  }

  @modelAction
  createLink(note: NoteModel) {
    note.linkedNoteBlocks.push(noteBlockRef(this));
    this.linkedNotes.push(noteRef(note));
  }

  @modelAction
  unlink(note: NoteModel) {
    const linkedNoteRef = this.linkedNotes.find((m) => m.current === note)!;
    const linkedNoteBlocksOfNote = linkedNoteRef.current.linkedNoteBlocks;

    linkedNoteBlocksOfNote.splice(
      linkedNoteBlocksOfNote.findIndex((ref) => ref.current === this),
      1
    );

    this.linkedNotes.splice(this.linkedNotes.indexOf(linkedNoteRef), 1);
  }
}
