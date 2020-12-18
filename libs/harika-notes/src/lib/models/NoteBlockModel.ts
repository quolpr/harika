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
import { NoteModel } from './NoteModel';
import { Store } from '../Store';

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
}) {
  @computed
  get parentChildRefs() {
    if (!this.parentBlockRef) {
      return this.rootChildRefs;
    }

    return this.parentBlockRef.current.childBlockRefs;
  }

  @computed
  get store() {
    return findParent<Store>(this, (n) => n instanceof Store);
  }

  @computed
  get rootChildRefs() {
    if (!this.noteRef) {
      console.error("Can't find note store");

      return [];
    }
    return this.noteRef.current.childBlockRefs;
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
  removeSelfFromParentChild() {
    return this.parentChildRefs.splice(this.orderPosition, 1);
  }

  @modelAction
  mergeToLeftAndDelete() {
    const [left] = this.leftAndRight;

    if (!left) return;

    if (this.parentChildRefs) {
      this.removeSelfFromParentChild();
    }

    left.content = left.content + this.content;

    left.childBlockRefs.push(
      ...this.childBlockRefs.map(({ current }) => noteBlockRef(current))
    );

    this.childBlockRefs.forEach(({ current: ch }) => {
      ch.parentBlockRef = noteBlockRef(left);
    });

    this.isDeleted = true;

    return left;
  }

  @modelAction
  injectNewRightBlock(content: string) {
    if (!this.noteRef.current) {
      console.error("Can't find note store");

      return;
    }

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
  makeParentTo(
    block: NoteBlockModel | undefined,
    afterBlock: NoteBlockModel | undefined
  ) {
    const refs = (() => {
      if (block) {
        return block.childBlockRefs;
      } else {
        return this.rootChildRefs;
      }
    })();

    const position = (() => {
      if (afterBlock) {
        return afterBlock.orderPosition + 1;
      } else {
        return 0;
      }
    })();

    this.parentChildRefs.splice(
      this.parentChildRefs.findIndex(({ current }) => current === this),
      1
    );

    this.parentBlockRef = block ? noteBlockRef(block) : undefined;

    refs.splice(position, 0, noteBlockRef(this));
  }

  @modelAction
  tryMoveLeft() {
    const [left] = this.leftAndRight;

    if (!left) return;

    if (left === this.parentBlockRef?.current) {
      // If left block is parent

      this.removeSelfFromParentChild();
      this.parentBlockRef = left.parentBlockRef
        ? noteBlockRef(left.parentBlockRef.current)
        : undefined;
      left.parentChildRefs.splice(left.orderPosition, 0, noteBlockRef(this));
    } else if (left.parentBlockRef?.current !== this.parentBlockRef?.current) {
      // If left is child of child of child...

      this.removeSelfFromParentChild();
      this.parentBlockRef = noteBlockRef(left);
      left.childBlockRefs.push(noteBlockRef(this));
    } else {
      // If the same level
      const currentOrderPosition = this.orderPosition;

      const [removedRef] = this.removeSelfFromParentChild();
      this.parentChildRefs.splice(currentOrderPosition - 1, 0, removedRef);
    }
  }

  @modelAction
  tryMoveRight() {}

  @modelAction
  tryMoveUp() {
    const [left] = this.leftAndRightSibling;

    if (left) {
      this.makeParentTo(
        left,
        left.childBlockRefs[left.childBlockRefs.length - 1]?.current
      );
    }
  }

  @modelAction
  tryMoveDown() {
    const parentRef = this.parentBlockRef;
    const parentOfParentRef = parentRef?.current?.parentBlockRef;

    if (parentOfParentRef === undefined && parentRef === undefined) return;

    this.makeParentTo(parentOfParentRef?.current, parentRef?.current);
  }

  @modelAction updateContent(content: string) {
    this.content = content;
  }

  @modelAction
  createNotesAndRefsIfNeeded() {}
}
