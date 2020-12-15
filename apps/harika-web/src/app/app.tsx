import React, { useEffect, useState } from 'react';
import './app.css';
import { Header } from './components/Header/Header';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { MainPageRedirect } from './pages/MainPageRedirect';
import { NotePage } from './pages/NotePage';
import { HarikaNotes } from '@harika/harika-notes';
import { Content } from './components/Content/Content';
import {
  CurrentFocusedBlockContext,
  CurrentNoteContext,
  HarikaStoreContext,
  ICurrentFocusedBlockState,
  ICurrentNoteState,
} from '@harika/harika-core';
import * as remotedev from 'remotedev';
import { onPatches } from 'mobx-keystone';

// const HandleNoteBlockBlur: React.FC = () => {
//   const database = useDatabase();
//   const [editState] = useContext(CurrentFocusedBlockContext);
//
//   const prevId = usePrevious(editState?.id);
//
//   useEffect(() => {
//     (async () => {
//       if (!prevId) return;
//
//       if (editState?.id !== prevId) {
//         const noteBlock = await database.collections
//           .get<NoteBlockModel>(HarikaNotesTableName.NOTE_BLOCKS)
//           .find(prevId);
//
//         await noteBlock.createNotesAndRefsIfNeeded();
//
//         console.log('notes and refs are created!');
//       }
//     })();
//   });
//
//   return null;
// };

const harikaNotes = new HarikaNotes();

export function App() {
  const stateActions = useState<ICurrentFocusedBlockState>();
  const currentNoteIdActions = useState<ICurrentNoteState>();

  useEffect(() => {
    // also it is possible to get a list of changes in the form of patches,
    // even with inverse patches to undo the changes
    const disposer = onPatches(
      harikaNotes.getMemDb(),
      (patches, _inversePatches) => {
        console.log(patches);
      }
    );
    return disposer;
  });

  return (
    <BrowserRouter>
      <HarikaStoreContext.Provider value={harikaNotes}>
        <CurrentNoteContext.Provider value={currentNoteIdActions}>
          <CurrentFocusedBlockContext.Provider value={stateActions}>
            {/**<HandleNoteBlockBlur />*/}

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
        </CurrentNoteContext.Provider>
      </HarikaStoreContext.Provider>
    </BrowserRouter>
  );
}
