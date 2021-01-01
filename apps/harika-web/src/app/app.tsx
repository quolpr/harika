import React, { useEffect, useState } from 'react';
import './app.css';
import { Header } from './components/Header/Header';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { MainPageRedirect } from './pages/MainPageRedirect';
import { NotePage } from './pages/NotePage';
import { HarikaVaults } from '@harika/harika-core';
import { Content } from './components/Content/Content';
import {
  CurrentFocusedBlockContext,
  CurrentNoteContext,
  CurrentVaultContext,
  ICurrentFocusedBlockState,
  ICurrentNoteState,
  useFocusedBlock,
  useCurrentVault,
} from '@harika/harika-utils';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { usePrevious } from 'react-use';

const HandleNoteBlockBlur: React.FC = () => {
  const vault = useCurrentVault();
  const focusedBlockState = useFocusedBlock();

  const prevNoteBlock = usePrevious(focusedBlockState?.noteBlock);

  useEffect(() => {
    (async () => {
      if (!prevNoteBlock) return;

      if (prevNoteBlock !== focusedBlockState?.noteBlock) {
        vault.updateNoteBlockLinks(prevNoteBlock);

        console.log('notes and refs are created!');
      }
    })();
  });

  return null;
};

const vaults = new HarikaVaults(
  ({ schema, dbName }) =>
    new LokiJSAdapter({
      schema,
      dbName, // optional db name
      // migrations, // optional migrations
      useWebWorker: false, // recommended for new projects. tends to improve performance and reduce glitches in most cases, but also has downsides - test with and without it
      useIncrementalIndexedDB: true, // recommended for new projects. improves performance (but incompatible with early Watermelon databases)
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
    } as any)
);

const vault = vaults.getVault('123');

const Syncher: React.FC = ({ children }) => {
  const vault = useCurrentVault();
  const [wasSynched, setWasSynched] = useState(false);

  useEffect(() => {
    const callback = async () => {
      await vault.sync();

      setWasSynched(true);
    };

    callback();
  }, [vault]);

  return <>{wasSynched && children}</>;
};

export function App() {
  const stateActions = useState<ICurrentFocusedBlockState>();
  const currentNoteActions = useState<ICurrentNoteState>();

  return (
    <BrowserRouter>
      <CurrentVaultContext.Provider value={vault}>
        <CurrentNoteContext.Provider value={currentNoteActions}>
          <CurrentFocusedBlockContext.Provider value={stateActions}>
            <Syncher>
              <HandleNoteBlockBlur />

              <Header />
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
            </Syncher>
          </CurrentFocusedBlockContext.Provider>
        </CurrentNoteContext.Provider>
      </CurrentVaultContext.Provider>
    </BrowserRouter>
  );
}
