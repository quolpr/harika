import React, { useEffect } from 'react';
import './App.css';
import './variables.css';
import { DailyNotePage } from './pages/DailyNotePage';
import { NotePage } from './pages/NotePage';
import { NotesPage } from './pages/NotesPage/NotesPage';
import Modal from 'react-modal';
import { VaultsPage } from './pages/VaultsPage/VaultsPage';
import { VaultLayout } from './components/VaultLayout/VaultLayout';
import { VaultsRepository } from '@harika/web-core';
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
import { Integrations } from '@sentry/tracing';
import * as Sentry from '@sentry/react';

const history = createBrowserHistory();

if (import.meta.env.MODE === 'production') {
  Sentry.init({
    dsn: 'https://6ce6cfabdd2b45aa8d6b402a10e261b1@o662294.ingest.sentry.io/5765293',
    integrations: [
      new Integrations.BrowserTracing({
        routingInstrumentation: Sentry.reactRouterV5Instrumentation(history),
      }),
    ],
    release: import.meta.env.SNOWPACK_PUBLIC_RELEASE_VERSION,

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });
}

Modal.setAppElement('body');

const queryClient = new QueryClient();

function NotProfiledApp() {
  const [authInfo, setAuthInfo] = useAuthState();
  const userId = authInfo?.userId;
  const isOffline = authInfo?.isOffline;

  const [lastVaultId] = useLocalStorage<string | undefined>('lastVaultId');

  const [vaultRepository, setVaultRepository] =
    useState<VaultsRepository | undefined>();

  useEffect(() => {
    function handleResize() {
      document.documentElement.style.setProperty(
        '--app-height',
        `${window.innerHeight}px`,
      );
    }

    window.addEventListener('resize', handleResize);

    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!userId || isOffline === undefined) return;

    let repo: VaultsRepository | undefined = undefined;

    const cb = async () => {
      repo = new VaultsRepository(userId, !isOffline, {
        wsUrl: import.meta.env.SNOWPACK_PUBLIC_WS_URL,
      });

      await repo.init();

      setVaultRepository(repo);
    };

    cb();

    return () => {
      repo?.destroy();
      setVaultRepository(undefined);
    };
  }, [userId, isOffline]);

  useEffect(() => {
    // lol safari
    // https://stackoverflow.com/questions/56496296/how-do-i-fix-firestore-sdk-hitting-an-internal-error-was-encountered-in-the-ind

    const handle = ({ message }: ErrorEvent) => {
      if (
        (message.indexOf(
          'An internal error was encountered in the Indexed Database server',
        ) >= 0 || message.indexOf('Connection to Indexed Database server')) >= 0
      ) {
        console.log('Refreshing page due to safari issue');

        // Refresh the page to restore IndexedDb to a working state.
        window.location.reload();
      }
    };

    window.addEventListener('error', handle);

    return () => {
      window.removeEventListener('error', handle);
    };
  }, []);

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

export const App = Sentry.withProfiler(NotProfiledApp);
