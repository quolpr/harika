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
  prop,
  prop_mapObject,
  Ref,
  tProp_dateTimestamp,
  types,
} from 'mobx-keystone';
import { action } from '@nozbe/watermelondb/decorators';
import { computed } from 'mobx';

const noteBlockRef = customRef<NoteBlock>('harika/NoteBlockRef', {
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

    return parent.list.get(ref.id);
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
export class NoteBlock extends Model({
  id: prop<string>(),
  childBlocks: prop<Ref<NoteBlock>[]>(() => []),
  parentBlock: prop<Ref<NoteBlock> | undefined>(),
  content: prop<string>(),
  updatedAt: tProp_dateTimestamp(types.dateTimestamp),
  createdAt: tProp_dateTimestamp(types.dateTimestamp),
}) {
  @computed
  get allSiblings() {
    if (!this.parentBlock) {
      return (
        findParent<NoteBlocksStore>(
          this,
          (n) => n instanceof NoteBlocksStore
        )?.rootList.map(({ current }) => current) || []
      );
    }

    return this.parentBlock.current.childBlocks.map(({ current }) => current);
  }

  @computed
  get leftAndRightSibling(): [
    left: NoteBlock | undefined,
    right: NoteBlock | undefined
  ] {
    const siblings = this.allSiblings;

    const index = siblings.findIndex((ch) => this.id === ch.id);

    return [siblings[index - 1], siblings[index + 1]];
  }

  @computed
  get lastTraversed(): NoteBlock {
    if (this.childBlocks.length === 0) return this;

    return this.childBlocks[this.childBlocks.length - 1].current.lastTraversed;
  }

  @computed
  get rightReversed(): NoteBlock | undefined {
    if (!this.parentBlock) return;

    const [, right] = this.parentBlock.current.leftAndRightSibling;

    if (right) return right;

    return this.parentBlock.current.rightReversed;
  }
}

@model('harika/NoteBlocksStore')
export class NoteBlocksStore extends Model({
  list: prop_mapObject(() => new Map<string, NoteBlock>()),
  rootList: prop<Ref<NoteBlock>[]>(() => []),
}) {}

const rootStore = new NoteBlocksStore({
  list: new Map([
    [
      '123',
      new NoteBlock({
        id: '123',
        childBlocks: [],
        parentBlock: undefined,
        content: 'heyy',
        updatedAt: new Date(),
        createdAt: new Date(),
      }),
    ],
  ]),
  rootList: [noteBlockRef('123')],
});

console.log('rootStore', rootStore.rootList[0].current.content);

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
