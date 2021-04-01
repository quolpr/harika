import './wdyr';
import React, { useEffect } from 'react';
import './App.css';
import './variables.css';
import { DailyNotePage } from './pages/DailyNotePage';
import { NotePage } from './pages/NotePage';
import { NotesPage } from './pages/NotesPage/NotesPage';
import Modal from 'react-modal';
import { VaultsPage } from './pages/VaultsPage/VaultsPage';
import { VaultLayout } from './components/VaultLayout/VaultLayout';
import { VaultRepository } from '@harika/harika-core';
import { PATHS, VAULT_PREFIX } from './paths';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SignupPage } from './pages/SignupPage/SignupPage';
import { OnlyAuthed } from './components/OnlyAuthed';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { useAuthState } from './hooks/useAuthState';
import { useState } from 'react';
import { Redirect, Route, Router } from 'react-router-dom';
import { createBrowserHistory } from 'history';

const history = createBrowserHistory();

Modal.setAppElement('body');

const queryClient = new QueryClient();

export function App() {
  const [authInfo] = useAuthState();
  const userId = authInfo?.userId;
  const token = authInfo?.token;
  const isOffline = authInfo?.isOffline;
  const dbId = authInfo?.dbId;

  const [vaultRepository, setVaultRepository] = useState<
    VaultRepository | undefined
  >();

  useEffect(() => {
    if (!userId || !token || !dbId || isOffline === undefined) return;

    let repo: VaultRepository | undefined = undefined;

    const cb = async () => {
      repo = new VaultRepository(dbId, !isOffline);

      await repo.init();

      setVaultRepository(repo);
    };

    cb();

    return () => {
      repo?.destroy();
      setVaultRepository(undefined);
    };
  }, [userId, token, isOffline, dbId]);

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <Router history={history}>
          <Route path={VAULT_PREFIX}>
            <OnlyAuthed>
              {vaultRepository && (
                <VaultLayout vaultRepository={vaultRepository}>
                  <Route exact path={PATHS.VAULT_DAILY_PATH}>
                    <DailyNotePage />
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
