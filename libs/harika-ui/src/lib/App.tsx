import './wdyr';
import React from 'react';
import './App.css';
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom';
import { MainPageRedirect } from './pages/MainPageRedirect';
import { NotePage } from './pages/NotePage';
import { NotesPage } from './pages/NotesPage/NotesPage';
import Modal from 'react-modal';
import { VaultsPage } from './pages/VaultsPage/VaultsPage';
import { VaultLayout } from './components/VaultLayout/VaultLayout';
import { VaultRepository } from '@harika/harika-core';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { PATHS } from './paths';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SignupPage } from './pages/SignupPage/SignupPage';

Modal.setAppElement('body');

const vaultRepository = new VaultRepository(
  ({ schema, dbName }) =>
    new LokiJSAdapter({
      schema,
      dbName, // optional vaultDb name
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

const queryClient = new QueryClient();

export function App() {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Switch>
            <Route exact path={PATHS.VAULT_DAILY_PATH}>
              <VaultLayout vaultRepository={vaultRepository}>
                <MainPageRedirect />
              </VaultLayout>
            </Route>
            <Route path={PATHS.VAULT_NOTE_PATH}>
              <VaultLayout vaultRepository={vaultRepository}>
                <NotePage />
              </VaultLayout>
            </Route>
            <Route path={PATHS.VAULT_NOTE_INDEX_PATH}>
              <VaultLayout vaultRepository={vaultRepository}>
                <NotesPage />
              </VaultLayout>
            </Route>
            <Route path={PATHS.VAULT_INDEX_PATH}>
              <VaultsPage vaults={vaultRepository} />
            </Route>
            <Route path={PATHS.SIGNUP_PATH}>
              <SignupPage />
            </Route>
            <Route path="/">
              <Redirect to={PATHS.DEFAULT_PATH} />
            </Route>
          </Switch>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}
