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
import { VaultsRepository } from '@harika/harika-core';
import { paths, PATHS, VAULT_PREFIX } from './paths';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SignupPage } from './pages/SignupPage/SignupPage';
import { OnlyAuthed } from './components/OnlyAuthed';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { useAuthState } from './hooks/useAuthState';
import { useState } from 'react';
import { Redirect, Route, Router, Switch } from 'react-router-dom';
import { createBrowserHistory } from 'history';
import { useLocalStorage } from '@rehooks/local-storage';
import { Environment } from './types';
import { env } from './env';

const history = createBrowserHistory();

Modal.setAppElement('body');

const queryClient = new QueryClient();

export function App({ environment }: { environment: Environment }) {
  const [authInfo, setAuthInfo] = useAuthState();
  const userId = authInfo?.userId;
  const isOffline = authInfo?.isOffline;

  const [lastVaultId] = useLocalStorage<string | undefined>('lastVaultId');

  const [vaultRepository, setVaultRepository] = useState<
    VaultsRepository | undefined
  >();

  useEffect(() => {
    env.baseApiUrl = environment.apiUrl;
    if (!userId || isOffline === undefined) return;

    let repo: VaultsRepository | undefined = undefined;

    const cb = async () => {
      repo = new VaultsRepository(userId, !isOffline, {
        wsUrl: environment.wsUrl,
      });

      await repo.init();

      setVaultRepository(repo);
    };

    cb();

    return () => {
      repo?.destroy();
      setVaultRepository(undefined);
    };
  }, [userId, isOffline, environment.apiUrl, environment.wsUrl]);

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <Router history={history}>
          <Switch>
            {/* <button */}
            {/*   onClick={() => { */}
            {/*     setAuthInfo(undefined); */}
            {/*   }} */}
            {/*   style={{ marginTop: 50 }} */}
            {/* > */}
            {/*   Reset auth */}
            {/* </button> */}
            <Route path={VAULT_PREFIX}>
              <OnlyAuthed>
                {vaultRepository && (
                  <VaultLayout vaultRepository={vaultRepository}>
                    <Switch>
                      <Route exact path={PATHS.VAULT_DAILY_PATH}>
                        <DailyNotePage />
                      </Route>

                      <Route exact path={PATHS.VAULT_NOTE_PATH}>
                        <NotePage />
                      </Route>

                      <Route exact path={PATHS.VAULT_NOTE_INDEX_PATH}>
                        <NotesPage />
                      </Route>
                    </Switch>
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

            <Route exact strict path="/">
              {() => {
                if (lastVaultId && authInfo) {
                  console.log({ lastVaultId, authInfo });

                  return (
                    <Redirect
                      to={paths.vaultDailyPath({ vaultId: lastVaultId })}
                    />
                  );
                } else {
                  return authInfo ? (
                    <Redirect to={PATHS.DEFAULT_PATH} />
                  ) : (
                    <Redirect to={PATHS.LOGIN_PATH} />
                  );
                }
              }}
            </Route>
          </Switch>
        </Router>
      </QueryClientProvider>
    </React.StrictMode>
  );
}
