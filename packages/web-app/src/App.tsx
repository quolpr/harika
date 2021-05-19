import React, { Suspense, useEffect } from 'react';
import './App.css';
import './variables.css';
import Modal from 'react-modal';
import { paths, PATHS, VAULT_PREFIX } from './paths';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAuthState } from './hooks/useAuthState';
import { Redirect, Route, Router, Switch } from 'react-router-dom';
import { createBrowserHistory } from 'history';
import { useLocalStorage } from '@rehooks/local-storage';
import { Integrations } from '@sentry/tracing';

const SignupPage = React.lazy(() => import('./pages/SignupPage/SignupPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage/LoginPage'));
const VaultAppRoute = React.lazy(() => import('./Routes/VaultAppRoute'));

const history = createBrowserHistory();

const importSentry = async () => {
  if (import.meta.env.MODE === 'production') {
    const Sentry = await import('@sentry/react');

    Sentry.init({
      dsn: 'https://6ce6cfabdd2b45aa8d6b402a10e261b1@o662294.ingest.sentry.io/5765293',
      integrations: [
        new Integrations.BrowserTracing({
          routingInstrumentation: Sentry.reactRouterV5Instrumentation(history),
        }),
      ],
      release: import.meta.env.SNOWPACK_PUBLIC_PACKAGE_VERSION,

      // Set tracesSampleRate to 1.0 to capture 100%
      // of transactions for performance monitoring.
      // We recommend adjusting this value in production
      tracesSampleRate: 1.0,
    });
  }
};

importSentry();

if (import.meta.env.MODE === 'production' && 'serviceWorker' in navigator) {
  // Use the window load event to keep the page load performant
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

Modal.setAppElement('body');

const queryClient = new QueryClient();

export const App = () => {
  const [authInfo] = useAuthState();

  const [lastVaultId] = useLocalStorage<string | undefined>('lastVaultId');

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

            <Route path={[VAULT_PREFIX, PATHS.VAULT_INDEX_PATH]}>
              <Suspense fallback={<div>Loading...</div>}>
                <VaultAppRoute />
              </Suspense>
            </Route>

            <Route exact path={PATHS.SIGNUP_PATH}>
              <Suspense fallback={<div>Loading...</div>}>
                <SignupPage />
              </Suspense>
            </Route>

            <Route exact path={PATHS.LOGIN_PATH}>
              <Suspense fallback={<div>Loading...</div>}>
                <LoginPage />
              </Suspense>
            </Route>

            <Route exact strict path="/">
              {() => {
                if (lastVaultId && authInfo) {
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
};
