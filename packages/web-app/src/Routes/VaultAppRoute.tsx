import React, { useContext, useMemo } from 'react';
import { Route, Routes } from 'react-router-dom';
import { VaultLayout } from '../components/VaultLayout/VaultLayout';
import { PATHS } from '../paths';
import { OnlyAuthed } from '../components/OnlyAuthed';
import { DailyNotePage } from '../pages/DailyNotePage';
import { NoteStackPage } from '../pages/NotePage';
import { NotesPage } from '../pages/NotesPage/NotesPage';
import { VaultsPage } from '../pages/VaultsPage/VaultsPage';
import { UserAppProvider } from '../hooks/useUserApp';
import { RoutesProps, UNSAFE_RouteContext as RouteContext } from 'react-router';

// It's taken from https://github.com/remix-run/react-router/issues/8035
function RootRoutes(props: RoutesProps) {
  const ctx = useContext(RouteContext);

  const value = useMemo(
    () => ({
      ...ctx,
      matches: [],
    }),
    [ctx],
  );

  return (
    <RouteContext.Provider value={value}>
      <Routes {...props} />
    </RouteContext.Provider>
  );
}

export const VaultLayoutWithUserApp: React.FC = ({ children }) => {
  return (
    <UserAppProvider>
      <OnlyAuthed>
        <VaultLayout>{children}</VaultLayout>
      </OnlyAuthed>
    </UserAppProvider>
  );
};

export const VaultAppRoute = () => {
  return (
    <RootRoutes>
      <Route
        path={PATHS.VAULT_DAILY_PATH}
        element={
          <VaultLayoutWithUserApp>
            <DailyNotePage />
          </VaultLayoutWithUserApp>
        }
      />
      <Route
        path={PATHS.VAULT_NOTE_PATH}
        element={
          <VaultLayoutWithUserApp>
            <NoteStackPage />
          </VaultLayoutWithUserApp>
        }
      />
      <Route
        path={PATHS.VAULT_NOTE_INDEX_PATH}
        element={
          <VaultLayoutWithUserApp>
            <NotesPage />
          </VaultLayoutWithUserApp>
        }
      />
      <Route
        path={PATHS.VAULT_INDEX_PATH}
        element={
          <UserAppProvider>
            <OnlyAuthed>
              <VaultsPage />
            </OnlyAuthed>
          </UserAppProvider>
        }
      />
    </RootRoutes>
  );
};

export default VaultAppRoute;
