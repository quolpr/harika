import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { MainPageRedirect } from './pages/MainPageRedirect';
import { NotePage } from './pages/NotePage';
import { NotesPage } from './pages/NotesPage/NotesPage';
import { HarikaVaults } from '@harika/harika-core';
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
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import clsx from 'clsx';

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

  const [isSidebarOpened, setIsSidebarOpened] = useState(false);

  const handleTogglerClick = useCallback(() => {
    setIsSidebarOpened(!isSidebarOpened);
  }, [isSidebarOpened]);

  return (
    <BrowserRouter>
      <CurrentVaultContext.Provider value={vault}>
        <CurrentNoteContext.Provider value={currentNoteActions}>
          <Syncher>
            <div className={clsx('app')}>
              <Sidebar
                className={clsx('app__sidebar', {
                  'app__sidebar--closed': !isSidebarOpened,
                })}
                isOpened={isSidebarOpened}
              />

              <div className="app__container">
                <div className="app__header-wrapper">
                  <Header
                    className="app__header"
                    onTogglerClick={handleTogglerClick}
                    isTogglerToggled={isSidebarOpened}
                  />
                </div>

                <div className="app__main-wrapper">
                  <section
                    className={clsx('app__main', {
                      'app__main--sidebar-opened': isSidebarOpened,
                    })}
                  >
                    <Switch>
                      <Route exact path="/">
                        <MainPageRedirect />
                      </Route>
                      <Route path="/notes/:id">
                        <NotePage />
                      </Route>
                      <Route path="/notes">
                        <NotesPage />
                      </Route>
                    </Switch>
                  </section>
                </div>
              </div>
            </div>
          </Syncher>
        </CurrentNoteContext.Provider>
      </CurrentVaultContext.Provider>
    </BrowserRouter>
  );
}
