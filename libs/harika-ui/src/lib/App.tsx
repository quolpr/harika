import './wdyr';
import React, { useEffect } from 'react';
import './App.css';
import { MainPageRedirect } from './pages/MainPageRedirect';
import { NotePage } from './pages/NotePage';
import { NotesPage } from './pages/NotesPage/NotesPage';
import Modal from 'react-modal';
import { VaultsPage } from './pages/VaultsPage/VaultsPage';
import { VaultLayout } from './components/VaultLayout/VaultLayout';
import { VaultRepository } from '@harika/harika-core';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { PATHS, VAULT_PREFIX } from './paths';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SignupPage } from './pages/SignupPage/SignupPage';
import { OnlyAuthed } from './components/OnlyAuthed';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { useAuthState } from './hooks/useAuthState';
import { useState } from 'react';
import { Redirect, Route, Router, Switch } from 'react-router-dom';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();

Modal.setAppElement('body');

const queryClient = new QueryClient();

export function App() {
  const [authInfo] = useAuthState();
  const userId = authInfo?.userId;
  const token = authInfo?.token;
  const isOffline = authInfo?.isOffline;

  const [vaultRepository, setVaultRepository] = useState<
    VaultRepository | undefined
  >();

  useEffect(() => {
    if (!userId || !token || isOffline === undefined) return;

    const repo = new VaultRepository(
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
        } as any),
      userId,
      token,
      isOffline
    );

    setVaultRepository(repo);

    return () => {
      repo.destroy();
      setVaultRepository(undefined);
    };
  }, [userId, token, isOffline]);

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <Router history={history}>
          <Route path={VAULT_PREFIX}>
            <OnlyAuthed>
              {vaultRepository && (
                <VaultLayout vaultRepository={vaultRepository}>
                  <Route exact path={PATHS.VAULT_DAILY_PATH}>
                    <MainPageRedirect />
                  </Route>

                  <Route exact path={PATHS.VAULT_NOTE_PATH}>
                    <NotePage />
                  </Route>

                  <Route exact path={PATHS.VAULT_NOTE_INDEX_PATH}>
                    <NotesPage />
                  </Route>
                </VaultLayout>
              )}
            </OnlyAuthed>
          </Route>

          <Route exact path={PATHS.VAULT_INDEX_PATH}>
            <OnlyAuthed>
              {vaultRepository && <VaultsPage vaults={vaultRepository} />}
            </OnlyAuthed>
          </Route>

          <Route exact path={PATHS.SIGNUP_PATH}>
            <SignupPage />
          </Route>

          <Route exact path={PATHS.LOGIN_PATH}>
            <LoginPage />
          </Route>

          <Route exact path="/">
            <Redirect to={PATHS.DEFAULT_PATH} />
          </Route>
        </Router>
      </QueryClientProvider>
    </React.StrictMode>
  );
}
