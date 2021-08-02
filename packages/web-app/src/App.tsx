import React, { MutableRefObject, Suspense, useEffect, useRef } from 'react';
import './App.css';
import './tailwind.css';
import './variables.css';
import Modal from 'react-modal';
import { paths, PATHS, VAULT_PREFIX } from './paths';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAuthState } from './hooks/useAuthState';
import { Redirect, Route, Router, Switch } from 'react-router-dom';
import { createBrowserHistory } from 'history';
import { useLocalStorage } from '@rehooks/local-storage';
import { Workbox } from 'workbox-window';
import { ShiftPressedContext } from './contexts/ShiftPressedContext';

const SignupPage = React.lazy(() => import('./pages/SignupPage/SignupPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage/LoginPage'));
const VaultAppRoute = React.lazy(() => import('./Routes/VaultAppRoute'));

const history = createBrowserHistory();

const importSentry = async () => {
  if (import.meta.env.MODE === 'production') {
    const [Sentry, { Integrations }] = await Promise.all([
      import('@sentry/react'),
      import('@sentry/tracing'),
    ]);

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

Modal.setAppElement('body');

const queryClient = new QueryClient();

const ShiftPressedTracker = ({
  shiftRef,
}: {
  shiftRef: MutableRefObject<boolean>;
}) => {
  useEffect(() => {
    const keyUpHandler = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
    };

    const keyDownHandler = () => {
      shiftRef.current = false;
    };

    document.addEventListener('keyup', keyUpHandler);
    document.addEventListener('keydown', keyDownHandler);

    return () => {
      document.removeEventListener('keyup', keyUpHandler);
      document.removeEventListener('keydown', keyDownHandler);
    };
  }, [shiftRef]);

  return null;
};

export const App = () => {
  const [authInfo] = useAuthState();

  const [lastVaultId] = useLocalStorage<string | undefined>('lastVaultId');

  useEffect(() => {
    if (import.meta.env.MODE === 'production' && 'serviceWorker' in navigator) {
      const wb = new Workbox('/sw.js');

      wb.addEventListener('waiting', () => {
        if (window.confirm('New version available. Update?')) {
          wb.addEventListener('controlling', () => {
            window.location.reload();
          });

          wb.messageSkipWaiting();
        }
      });
    }
  }, []);

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

  const isShiftPressedRef = useRef(false);

  return (
    <React.StrictMode>
      <ShiftPressedContext.Provider value={isShiftPressedRef}>
        <ShiftPressedTracker shiftRef={isShiftPressedRef} />

        <QueryClientProvider client={queryClient}>
          <Router history={history}>
            <Switch>
              <Route path={[VAULT_PREFIX, PATHS.VAULT_INDEX_PATH]}>
                <Suspense fallback={<div></div>}>
                  <VaultAppRoute />
                </Suspense>
              </Route>

              <Route exact path={PATHS.SIGNUP_PATH}>
                <Suspense fallback={<div></div>}>
                  <SignupPage />
                </Suspense>
              </Route>

              <Route exact path={PATHS.LOGIN_PATH}>
                <Suspense fallback={<div></div>}>
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
      </ShiftPressedContext.Provider>
    </React.StrictMode>
  );
};
