import React, { useEffect, useState } from 'react';
import './app.css';
import { Header } from './components/Header/Header';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { MainPageRedirect } from './pages/MainPageRedirect';
import { NotePage } from './pages/NotePage';
import { usePrevious } from 'react-use';
import { useContext } from 'use-context-selector';
import { HarikaNotesTableName } from '@harika/harika-notes';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Content } from './components/Content/Content';
import {
  CurrentFocusedBlockContext,
  CurrentNoteIdContext,
  ICurrentFocusedBlockState,
  ICurrentNoteIdState,
} from '@harika/harika-core';
import {
  customRef,
  detach,
  findParent,
  model,
  Model,
  modelAction,
  ModelPropsCreationData,
  prop,
  Ref,
  tProp_dateTimestamp,
  types,
} from 'mobx-keystone';
import { action } from '@nozbe/watermelondb/decorators';
import { computed } from 'mobx';
import { v4 as uuidv4 } from 'uuid';

const noteBlockRef = customRef<NoteBlockMobxModel>('harika/NoteBlockRef', {
  // this works, but we will use getRefId() from the Todo class instead
  // getId(maybeTodo) {
  //   return maybeTodo instanceof Todo ? maybeTodo.id : undefined
  // },

  resolve(ref) {
    const parent = findParent<NoteBlocksStore>(
      ref,
      (n) => n instanceof NoteBlocksStore
    );

    if (!parent) return undefined;

    return parent.rootChildRefs[ref.id];
  },
  onResolvedValueChange(ref, newTodo, oldTodo) {
    if (oldTodo && !newTodo) {
      // if the todo value we were referencing disappeared then remove the reference
      // from its parent
      detach(ref);
    }
  },
});

@model('harika/NoteBlock')
export class NoteBlockMobxModel extends Model({
  id: prop<string>(),
  childBlockRefs: prop<Ref<NoteBlockMobxModel>[]>(() => []),
  parentBlockRef: prop<Ref<NoteBlockMobxModel> | undefined>(),
  content: prop<string>(),
  updatedAt: tProp_dateTimestamp(types.dateTimestamp),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
  isDeleted: prop<boolean>(false),
}) {
  @computed
  get parentChildRefs() {
    if (!this.parentBlockRef) {
      return this.rootChildRefs;
    }

    return this.parentBlockRef.current.childBlockRefs;
  }

  @computed
  get noteBlocksStore() {
    return findParent<NoteBlocksStore>(
      this,
      (n) => n instanceof NoteBlocksStore
    );
  }

  @computed
  get rootChildRefs() {
    if (!this.noteBlocksStore) {
      console.error("Can't find notes block store");

      return [];
    }
    return this.noteBlocksStore.rootList;
  }

  @computed
  get orderPosition() {
    const siblings = this.allSiblings;

    return siblings.findIndex((ch) => this.id === ch.id);
  }

  @computed
  get allSiblings() {
    return this.parentChildRefs.map(({ current }) => current);
  }

  @computed
  get leftAndRightSibling(): [
    left: NoteBlockMobxModel | undefined,
    right: NoteBlockMobxModel | undefined
  ] {
    const siblings = this.allSiblings;
    const index = this.orderPosition;

    return [siblings[index - 1], siblings[index + 1]];
  }

  @computed
  get deepLastRightChild(): NoteBlockMobxModel {
    if (this.childBlockRefs.length === 0) return this;

    return this.childBlockRefs[this.childBlockRefs.length - 1].current
      .deepLastRightChild;
  }

  @computed
  get nearestRightToParent(): NoteBlockMobxModel | undefined {
    if (!this.parentBlockRef) return;

    const [, right] = this.parentBlockRef.current.leftAndRightSibling;

    if (right) return right;

    return this.parentBlockRef.current.nearestRightToParent;
  }

  @computed
  get leftAndRight(): [
    left: NoteBlockMobxModel | undefined,
    right: NoteBlockMobxModel | undefined
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
  mergeToLeftAndDelete() {
    const [left] = this.leftAndRight;

    if (!left) return;

    left.content = left.content + this.content;
    left.childBlockRefs.push(...this.childBlockRefs);

    const children = this.childBlockRefs.map(({ current }) => current);

    children.forEach((ch) => {
      ch.parentBlockRef = noteBlockRef(left);
    });

    this.isDeleted = true;

    return left;
  }

  @modelAction
  injectNewRightBlock(content: string) {
    if (!this.noteBlocksStore) {
      console.error('Note block store is not set!');

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
          parentRef: this.parentBlockRef,
          list: this.parentChildRefs,
        };
      }
    })();

    const newNoteBlock = this.noteBlocksStore.create({
      childBlockRefs: [],
      parentBlockRef: parentRef,
      content: content,
    });

    list.splice(injectTo, 0, noteBlockRef(newNoteBlock));

    return newNoteBlock;
  }

  @modelAction
  makeParentTo(
    block: NoteBlockMobxModel | undefined,
    afterBlock: NoteBlockMobxModel | undefined
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
  tryMoveLeft() {}

  @modelAction
  tryMoveRight() {}

  @modelAction
  tryMoveUp() {
    const [left] = this.leftAndRightSibling;

    if (left) {
      this.makeParentTo(
        left,
        left.childBlockRefs[left.childBlockRefs.length - 1].current
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
}

@model('harika/NoteBlocksStore')
export class NoteBlocksStore extends Model({
  rootChildRefs: prop<Record<string, NoteBlockMobxModel>>(() => ({})),
  rootList: prop<Ref<NoteBlockMobxModel>[]>(() => []),
}) {
  // TODO: how to extract props??
  @action
  create(
    attrs: Omit<
      ModelPropsCreationData<NoteBlockMobxModel>,
      'id' | 'updatedAt' | 'createdAt'
    >
  ) {
    const newNoteBlock = new NoteBlockMobxModel({
      // TODO: random id generator
      id: uuidv4(),
      updatedAt: new Date(),
      createdAt: new Date(),
      ...attrs,
    });

    this.rootChildRefs[newNoteBlock.id] = newNoteBlock;

    return newNoteBlock;
  }
}

const rootStore = new NoteBlocksStore({
  rootChildRefs: {
    '123': new NoteBlockMobxModel({
      id: '123',
      childBlockRefs: [],
      parentBlockRef: undefined,
      content: 'heyy',
      updatedAt: new Date(),
      createdAt: new Date(),
    }),
  },
  rootList: [noteBlockRef('123')],
});

const HandleNoteBlockBlur: React.FC = () => {
  const database = useDatabase();
  const [editState] = useContext(CurrentFocusedBlockContext);

  const prevId = usePrevious(editState?.id);

  useEffect(() => {
    (async () => {
      if (!prevId) return;

      if (editState?.id !== prevId) {
        const noteBlock = await database.collections
          .get<NoteBlockModel>(HarikaNotesTableName.NOTE_BLOCKS)
          .find(prevId);

        await noteBlock.createNotesAndRefsIfNeeded();

        console.log('notes and refs are created!');
      }
    })();
  });

  return null;
};

export function App() {
  const stateActions = useState<ICurrentFocusedBlockState>();
  const currentNoteIdActions = useState<ICurrentNoteIdState>();

  return (
    <BrowserRouter>
      <CurrentNoteIdContext.Provider value={currentNoteIdActions}>
        <CurrentFocusedBlockContext.Provider value={stateActions}>
          <HandleNoteBlockBlur />

          <Header />
          <Content />
          <section className="main">
            <Switch>
              <Route exact path="/">
                <MainPageRedirect />
              </Route>
              <Route path="/notes/:id">
                <NotePage />
              </Route>
            </Switch>
          </section>
        </CurrentFocusedBlockContext.Provider>
      </CurrentNoteIdContext.Provider>
    </BrowserRouter>
  );
}
