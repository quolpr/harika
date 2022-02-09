import React, { MutableRefObject, Suspense, useEffect, useRef } from 'react';
import './App.css';
import './tailwind.css';
import './variables.css';
import Modal from 'react-modal';
import { paths, PATHS, VAULT_PREFIX } from './paths';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAuthState } from './hooks/useAuthState';
import {
  BrowserRouter,
  Navigate,
  Route,
  Router,
  Routes,
} from 'react-router-dom';
import { useLocalStorage } from '@rehooks/local-storage';
import { ShiftPressedContext } from './contexts/ShiftPressedContext';
import './firebaseApp';

const SignupPage = React.lazy(() => import('./pages/SignupPage/SignupPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage/LoginPage'));
const VaultAppRoute = React.lazy(() => import('./Routes/VaultAppRoute'));

const importSentry = async () => {
  if (import.meta.env.MODE === 'production') {
    const [Sentry] = await Promise.all([
      import('@sentry/react'),
      import('@sentry/tracing'),
    ]);

    Sentry.init({
      dsn: 'https://6ce6cfabdd2b45aa8d6b402a10e261b1@o662294.ingest.sentry.io/5765293',
      release: import.meta.env.VITE_PUBLIC_PACKAGE_VERSION as string,

      // Set tracesSampleRate to 1.0 to capture 100%
      // of transactions for performance monitoring.
      // We recommend adjusting this value in production
      tracesSampleRate: 1.0,
      normalizeDepth: 10,
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
    <ShiftPressedContext.Provider value={isShiftPressedRef}>
      <ShiftPressedTracker shiftRef={isShiftPressedRef} />

      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {[VAULT_PREFIX + '/*', PATHS.VAULT_INDEX_PATH + '/*'].map(
              (path) => (
                <Route
                  path={path}
                  key={path}
                  element={
                    <Suspense fallback={<div></div>}>
                      <VaultAppRoute />
                    </Suspense>
                  }
                ></Route>
              ),
            )}

            <Route
              path={PATHS.SIGNUP_PATH}
              element={
                <Suspense fallback={<div></div>}>
                  <SignupPage />
                </Suspense>
              }
            />

            <Route
              path={PATHS.LOGIN_PATH}
              element={
                <Suspense fallback={<div></div>}>
                  <LoginPage />
                </Suspense>
              }
            />

            <Route
              path="/"
              element={(() => {
                if (lastVaultId && authInfo) {
                  return (
                    <Navigate
                      to={paths.vaultDailyPath({ vaultId: lastVaultId })}
                      replace
                    />
                  );
                } else {
                  return authInfo ? (
                    <Navigate to={PATHS.DEFAULT_PATH} replace />
                  ) : (
                    <Navigate to={PATHS.LOGIN_PATH} replace />
                  );
                }
              })()}
            />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ShiftPressedContext.Provider>
  );
};
