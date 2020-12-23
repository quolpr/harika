import React, { useEffect, useState } from 'react';
import './app.css';
import { Header } from './components/Header/Header';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { MainPageRedirect } from './pages/MainPageRedirect';
import { NotePage } from './pages/NotePage';
import { HarikaNotes, schema } from '@harika/harika-notes';
import { Content } from './components/Content/Content';
import {
  CurrentFocusedBlockContext,
  CurrentNoteContext,
  HarikaStoreContext,
  ICurrentFocusedBlockState,
  ICurrentNoteState,
  useFocusedBlock,
  useHarikaStore,
} from '@harika/harika-core';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { usePrevious } from 'react-use';

const HandleNoteBlockBlur: React.FC = () => {
  const store = useHarikaStore();
  const focusedBlockState = useFocusedBlock();

  const prevNoteBlock = usePrevious(focusedBlockState?.noteBlock);

  useEffect(() => {
    (async () => {
      if (!prevNoteBlock) return;

      if (prevNoteBlock !== focusedBlockState?.noteBlock) {
        store.updateNoteBlockLinks(prevNoteBlock);

        console.log('notes and refs are created!');
      }
    })();
  });

  return null;
};

const adapter = new LokiJSAdapter({
  schema: schema,
  // migrations, // optional migrations
  useWebWorker: false, // recommended for new projects. tends to improve performance and reduce glitches in most cases, but also has downsides - test with and without it
  useIncrementalIndexedDB: true, // recommended for new projects. improves performance (but incompatible with early Watermelon databases)
  // dbName: 'myapp', // optional db name
  // It's recommended you implement this method:
  // onIndexedDBVersionChange: () => {
  //   // database was deleted in another browser tab (user logged out), so we must make sure we delete
  //   // it in this tab as well
  //   if (checkIfUserIsLoggedIn()) {
  //     window.location.reload()
  //   }
  // },
  // Optional:
  // onQuotaExceededError: (error) => { /* do something when user runs out of disk space */ },
} as any);

const harikaNotes = new HarikaNotes(adapter);

export function App() {
  const stateActions = useState<ICurrentFocusedBlockState>();
  const currentNoteActions = useState<ICurrentNoteState>();

  return (
    <BrowserRouter>
      <HarikaStoreContext.Provider value={harikaNotes}>
        <CurrentNoteContext.Provider value={currentNoteActions}>
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
        </CurrentNoteContext.Provider>
      </HarikaStoreContext.Provider>
    </BrowserRouter>
  );
}
