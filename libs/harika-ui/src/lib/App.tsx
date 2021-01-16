import './wdyr';
import React from 'react';
import './App.css';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { MainPageRedirect } from './pages/MainPageRedirect';
import { NotePage } from './pages/NotePage';
import { NotesPage } from './pages/NotesPage/NotesPage';
import Modal from 'react-modal';
import { VaultsPage } from './pages/VaultsPage/VaultsPage';
import { VaultLayout } from './components/VaultLayout/VaultLayout';
import { initializeVaults } from '@harika/harika-core';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

Modal.setAppElement('body');

const vaults = initializeVaults(
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

export function App() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <Switch>
          <Route exact path="/vaults/:vaultId">
            <VaultLayout vaults={vaults}>
              <MainPageRedirect />
            </VaultLayout>
          </Route>
          <Route path="/vaults/:vaultId/notes/:id">
            <VaultLayout vaults={vaults}>
              <NotePage />
            </VaultLayout>
          </Route>
          <Route path="/vaults/:vaultId/notes">
            <VaultLayout vaults={vaults}>
              <NotesPage />
            </VaultLayout>
          </Route>
          <Route path="/vaults">
            <VaultsPage vaults={vaults} />
          </Route>
        </Switch>
      </BrowserRouter>
    </React.StrictMode>
  );
}
