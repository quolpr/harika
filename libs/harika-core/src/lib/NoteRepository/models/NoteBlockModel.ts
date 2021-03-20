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
import { comparer, computed } from 'mobx';
import { NoteModel } from './NoteModel';
import { BlocksViewModel } from './BlocksViewModel';
import type { VaultModel } from './Vault';
import { isVault } from './utils';

export const noteBlockRef = customRef<NoteBlockModel>('harika/NoteBlockRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const vault = findParent<VaultModel>(this, isVault);

    if (!vault) return undefined;

    return vault.blocksMap[ref.id];
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
  parentBlockRef: prop<Ref<NoteBlockModel> | undefined>(),
  noteRef: prop<Ref<NoteModel>>(),
  content: prop<string>(),
  orderPosition: prop<number>(),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  isDeleted: prop<boolean>(false),
}) {
  @computed
  get hasChildren() {
    return this.children.length !== 0;
  }

  @computed({ equals: comparer.shallow })
  get path() {
    let current: NoteBlockModel | undefined = this.parentBlockRef?.current;
    const path: NoteBlockModel[] = [];

    while (current) {
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
  get noteLinks() {
    return this.vault.noteLinks.filter(
      (link) => !link.isDeleted && link.noteBlockRef.id === this.$modelId
    );
  }

  @computed({ equals: comparer.shallow })
  get children() {
    return this.noteRef.current.allChildren
      .filter((block) => block.parentBlockRef?.id === this.$modelId)
      .sort((a, b) => a.orderPosition - b.orderPosition);
  }

  @computed({ equals: comparer.shallow })
  get siblings() {
    if (!this.parentBlockRef) {
      return this.noteRef.current.children;
    }

    return this.parentBlockRef.current.children;
  }

  @computed({ equals: comparer.shallow })
  get leftAndRightSibling(): [
    left: NoteBlockModel | undefined,
    right: NoteBlockModel | undefined
  ] {
    const siblings = this.siblings;
    const index = siblings.findIndex((nb) => this.$modelId === nb.$modelId);

    return [siblings[index - 1], siblings[index + 1]];
  }

  @computed
  get deepLastRightChild(): NoteBlockModel {
    if (this.children.length === 0) return this;

    return this.children[this.children.length - 1].deepLastRightChild;
  }

  @computed
  get nearestRightToParent(): NoteBlockModel | undefined {
    if (!this.parentBlockRef) return;

    const [, right] = this.parentBlockRef.current.leftAndRightSibling;

    if (right) return right;

    return this.parentBlockRef.current.nearestRightToParent;
  }

  @computed({ equals: comparer.shallow })
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

    const children = this.children;

    if (children[0]) {
      right = children[0];
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
  move(parent: undefined | NoteBlockModel, pos: number | 'start' | 'end') {
    if (parent !== this.parentBlockRef?.current) {
      this.parentBlockRef = parent ? noteBlockRef(parent) : undefined;
    }

    const childBlocks = (() => {
      if (parent) {
        return parent.children;
      } else {
        return this.noteRef.current.children;
      }
    })();

    const newPos = (() => {
      if (pos === 'start') {
        return 0;
      } else if (pos === 'end') {
        return (
          Math.max(
            ...childBlocks.map(({ orderPosition }) => orderPosition),
            -1
          ) + 1
        );
      } else {
        return pos;
      }
    })();

    childBlocks
      .filter(({ orderPosition }) => orderPosition >= newPos)
      .forEach((block) => {
        block.orderPosition = block.orderPosition + 1;
      });

    this.orderPosition = newPos;
  }

  @modelAction
  mergeToLeftAndDelete() {
    const [left] = this.leftAndRight;

    if (!left) return;

    left.content = left.content + this.content;

    this.children.forEach((ch) => {
      ch.parentBlockRef = noteBlockRef(left);
    });

    this.parentBlockRef = undefined;
    this.isDeleted = true;

    return left;
  }

  @modelAction
  injectNewRightBlock(content: string, view: BlocksViewModel) {
    const { injectTo, parentRef, list } = (() => {
      if (this.children.length && view.isExpanded(this.$modelId)) {
        return {
          injectTo: 0,
          parentRef: noteBlockRef(this),
          list: this.children,
        };
      } else {
        return {
          injectTo: this.orderPosition + 1,
          parentRef: this.parentBlockRef
            ? noteBlockRef(this.parentBlockRef.current)
            : undefined,
          list: this.siblings,
        };
      }
    })();

    list
      .filter(({ orderPosition }) => orderPosition >= injectTo)
      .forEach((block) => {
        block.orderPosition = block.orderPosition + 1;
      });

    const newNoteBlock = this.noteRef.current.createBlock({
      parentBlockRef: parentRef,
      content: content,
      orderPosition: injectTo,
    });

    // TODO: move all siblings right

    return newNoteBlock;
  }

  @modelAction
  tryMoveLeft() {
    const [left] = this.leftAndRight;

    console.log({ left: left?.$modelId });

    if (!left) return;

    if (left === this.parentBlockRef?.current) {
      // If left block is parent

      this.move(left.parentBlockRef?.current, left.orderPosition);
    } else if (left.parentBlockRef?.current !== this.parentBlockRef?.current) {
      // If left is child of child of child...

      this.move(left.parentBlockRef?.current, left.orderPosition + 1);
    } else {
      // if same level

      this.move(this.parentBlockRef?.current, left.orderPosition - 1);
    }
  }

  @modelAction
  tryMoveRight() {
    let [, right] = this.leftAndRightSibling;
    let isSibling = true;

    if (!right) {
      right = this.nearestRightToParent;
      isSibling = false;
    }

    if (!right) return;

    if (right.children.length) {
      this.move(right, 'start');
    } else {
      this.move(
        right.parentBlockRef?.current,
        isSibling ? right.orderPosition + 1 : right.orderPosition
      );
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
  updateAttrs(data: ModelInstanceCreationData<NoteBlockModel>) {
    if (
      data.content !== undefined &&
      data.content !== null &&
      data.content !== this.$.content
    ) {
      this.content = data.content;
    }

    if (data.noteRef && data.noteRef.id !== this.$.noteRef.id) {
      this.noteRef = data.noteRef;
    }

    if (data.createdAt && data.createdAt !== this.createdAt) {
      this.createdAt = data.createdAt;
    }

    if (data.orderPosition !== this.orderPosition) {
      this.orderPosition = data.orderPosition;
    }

    if (data.parentBlockRef?.id !== this.parentBlockRef?.id) {
      this.parentBlockRef = data.parentBlockRef;
    }
  }

  @modelAction
  delete(recursively = true, links = true) {
    if (recursively) {
      this.children.forEach((block) => block.delete(true, links));
    }

    if (links) {
      this.noteLinks.forEach((link) => link.delete());
    }

    this.isDeleted = true;
  }
}