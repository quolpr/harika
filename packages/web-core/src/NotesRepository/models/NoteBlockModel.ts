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
  types,
} from 'mobx-keystone';
import { comparer, computed } from 'mobx';
import { NoteModel, noteRef } from './NoteModel';
import type { VaultModel } from './VaultModel';
import { isVault } from './utils';
import { isEqual } from 'lodash-es';
import { BlockContentModel } from './NoteBlockModel/BlockContentModel';
import type { BlocksViewModel } from './VaultUiState/BlocksViewModel';
import type { TreeToken } from './NoteBlockModel/parseStringToTree';
import { addTokensToNoteBlock } from '../../tests/blockUtils';

export const noteBlockRef = customRef<NoteBlockModel>('harika/NoteBlockRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const vault = findParent<VaultModel>(this, isVault);

    if (!vault) {
      return undefined;
    }

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
  noteRef: prop<Ref<NoteModel>>(),
  content: prop<BlockContentModel>(),
  noteBlockRefs: prop<Ref<NoteBlockModel>[]>(),
  linkedNoteRefs: prop<Ref<NoteModel>[]>(),
  createdAt: tProp(types.dateTimestamp),
  isDeleted: prop<boolean>(false),
}) {
  get parentBlock() {
    const id = this.noteRef.current.childParentRelations[this.$modelId];

    return id === undefined ? undefined : this.vault.blocksMap[id];
  }

  @computed({ equals: comparer.shallow })
  get flattenTree(): NoteBlockModel[] {
    // optimization required here, but how?
    const blocks: NoteBlockModel[] = [];

    this.noteBlockRefs.forEach((block) => {
      blocks.push(block.current);
      blocks.push(...block.current.flattenTree);
    });

    return blocks;
  }

  @computed
  get indent() {
    return this.path.length;
  }

  @computed
  get isRoot() {
    return this.parentBlock === undefined;
  }

  @computed({ equals: comparer.shallow })
  get noteBlockIds() {
    return this.noteBlockRefs.map(({ id }) => id);
  }

  @computed({ equals: comparer.shallow })
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
    return this.parentBlock ? this.parentBlock.orderHash[this.$modelId] : 0;
  }

  @computed
  get hasChildren() {
    return this.noteBlockRefs.length !== 0;
  }

  @computed({ equals: comparer.shallow })
  get path() {
    let current: NoteBlockModel | undefined = this.parentBlock;
    const path: NoteBlockModel[] = [];

    while (current) {
      path.unshift(current);
      current = current.parentBlock;
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
    if (!this.parentBlock) {
      throw new Error("You can't get sibling of root noteblock");
    }

    return this.parentBlock.noteBlockRefs;
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
    if (!this.parentBlock || this.parentBlock.isRoot) return undefined;

    const [, right] = this.parentBlock.leftAndRightSibling;

    if (right) return right;

    return this.parentBlock.nearestRightToParent;
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

    if (!left && this.parentBlock !== undefined && !this.parentBlock.isRoot) {
      left = this.parentBlock;
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

  getStringTree(includeId = false, indent = this.isRoot ? -1 : 0): string {
    let str = this.isRoot
      ? ''
      : `${'  '.repeat(indent)}- ${this.content.value}${
          includeId ? ` [#${this.$modelId}]` : ''
        }\n`;

    this.noteBlockRefs.forEach((blockRef) => {
      str += blockRef.current.getStringTree(
        includeId,
        this.isRoot ? 0 : indent + 1,
      );
    });

    return str;
  }

  @modelAction
  move(parent: NoteBlockModel, pos: number | 'start' | 'end') {
    if (!this.parentBlock) {
      throw new Error("Can't move root block");
    }

    this.parentBlock.noteBlockRefs.splice(this.orderPosition, 1);

    const newPos = (() => {
      if (pos === 'start') {
        return 0;
      } else if (pos === 'end') {
        return parent.noteBlockRefs.length;
      } else {
        return pos;
      }
    })();

    parent.noteBlockRefs.splice(newPos, 0, noteBlockRef(this));
  }

  @modelAction
  mergeToLeftAndDelete() {
    const [left] = this.leftAndRight;

    if (!left) return;

    left.content.update(left.content.value + this.content.value);

    left.noteBlockRefs.push(
      ...this.noteBlockRefs.map((r) => noteBlockRef(r.id)),
    );

    left.linkedNoteRefs.push(...this.linkedNoteRefs.map((r) => noteRef(r.id)));

    this.delete(false, false);

    return left;
  }

  @modelAction
  appendChildBlock(block: NoteBlockModel) {
    this.noteBlockRefs.push(noteBlockRef(block));
  }

  @modelAction
  merge(rootBlock: NoteBlockModel) {
    const noteBlockRefs = rootBlock.noteBlockRefs;
    rootBlock.noteBlockRefs = [];

    if (this.isRoot) {
      this.noteBlockRefs.splice(0, 0, ...noteBlockRefs);
    } else {
      this.parentBlock!.noteBlockRefs.splice(
        this.orderPosition + 1,
        0,
        ...noteBlockRefs,
      );
    }
  }

  @modelAction
  createAndAppendChildBlock(data: { content: string; id?: string }) {
    return this.noteRef.current.createBlock(
      {
        content: new BlockContentModel({ value: data.content }),
        ...(data.id ? { $modelId: data.id } : {}),
      },
      this,
      this.noteBlockRefs.length,
    );
  }

  @modelAction
  injectNewTreeTokens(tokens: TreeToken[]) {
    return addTokensToNoteBlock(this.noteRef.current, this, tokens);
  }

  @modelAction
  injectNewRightBlock(content: string, view: BlocksViewModel) {
    if (!this.parentBlock) {
      throw new Error("Can't inject from root block");
    }

    const { injectTo, parent } = (() => {
      if (this.noteBlockRefs.length && view.isExpanded(this.$modelId)) {
        return {
          injectTo: 0,
          parent: this,
        };
      } else {
        return {
          injectTo: this.orderPosition + 1,
          parent: this.parentBlock,
        };
      }
    })();

    const newNoteBlock = this.noteRef.current.createBlock(
      {
        content: new BlockContentModel({ value: content }),
      },
      parent,
      injectTo,
    );

    return newNoteBlock;
  }

  @modelAction
  tryMoveLeft() {
    if (!this.parentBlock) {
      throw new Error("Can't move root block");
    }

    const [left] = this.leftAndRight;

    if (!left) return;

    if (!left.parentBlock) {
      throw new Error("Left couldn't be root block");
    }

    if (left === this.parentBlock) {
      // If left block is parent

      this.move(left.parentBlock, left.orderPosition);
    } else if (left.parentBlock !== this.parentBlock) {
      // If left is child of child of child...

      this.move(left.parentBlock, left.orderPosition + 1);
    } else {
      // if same level

      this.move(this.parentBlock, left.orderPosition);
    }
  }

  @modelAction
  tryMoveRight() {
    let [, right] = this.leftAndRightSibling;

    if (!right) {
      right = this.nearestRightToParent;
    }

    if (!right) return;

    if (!right.parentBlock) {
      throw new Error("Right couldn't be root block");
    }

    if (right.noteBlockRefs.length) {
      this.move(right, 'start');
    } else {
      this.move(right.parentBlock, right.orderPosition);
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
    const parentRef = this.parentBlock;
    const parentOfParent = parentRef?.parentBlock;

    if (!parentRef || !parentOfParent) return;

    this.move(parentOfParent, parentRef.orderPosition + 1);
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

    if (
      data.noteBlockRefs &&
      !isEqual(
        data.noteBlockRefs.map(({ id }) => id),
        this.noteBlockIds,
      )
    ) {
      const currentRefs = Object.fromEntries(
        this.noteBlockRefs.map((ref) => [ref.id, ref]),
      );

      this.noteBlockRefs = data.noteBlockRefs.map((ref) =>
        currentRefs[ref.id] ? currentRefs[ref.id] : ref,
      );
    }

    if (
      data.linkedNoteRefs &&
      !isEqual(
        data.linkedNoteRefs.map(({ id }) => id),
        this.linkedNoteRefs,
      )
    ) {
      const currentRefs = Object.fromEntries(
        this.linkedNoteRefs.map((ref) => [ref.id, ref]),
      );

      this.linkedNoteRefs = data.linkedNoteRefs.map((ref) =>
        currentRefs[ref.id] ? currentRefs[ref.id] : ref,
      );
    }
  }

  @modelAction
  delete(recursively = true, links = true) {
    if (recursively) {
      this.noteBlockRefs.forEach((block) => block.current.delete(true, links));
    }

    if (this.parentBlock) {
      this.parentBlock.noteBlockRefs.splice(this.orderPosition, 1);
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
