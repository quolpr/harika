import './tailwind.css';
import './App.css';
import './variables.css';
import './firebaseApp';

import { useLocalStorage } from '@rehooks/local-storage';
import React, { MutableRefObject, useEffect, useRef } from 'react';
import Modal from 'react-modal';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ShiftPressedContext } from './contexts/ShiftPressedContext';
import { useAuthState } from './hooks/useAuthState';
import LoginPage from './pages/LoginPage/LoginPage';
import SignupPage from './pages/SignupPage/SignupPage';
import { PATHS, paths, VAULT_PREFIX } from './paths';
import VaultAppRoute from './Routes/VaultAppRoute';

// I wanted to make lazy loading with suspense + React.lazy, but sometime components got
// rendered twice. I will wait for React 18 become stable
// const SignupPage = React.lazy(() => import('./pages/SignupPage/SignupPage'));
// const LoginPage = React.lazy(() => import('./pages/LoginPage/LoginPage'));
// const VaultAppRoute = React.lazy(() => import('./Routes/VaultAppRoute'));

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
            <Route path={VAULT_PREFIX + '/*'} element={<VaultAppRoute />} />
            <Route path={PATHS.VAULT_INDEX_PATH} element={<VaultAppRoute />} />
            <Route path={PATHS.SIGNUP_PATH} element={<SignupPage />} />
            <Route path={PATHS.LOGIN_PATH} element={<LoginPage />} />

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
