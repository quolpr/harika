import React, { useContext, useMemo } from 'react';
import { RoutesProps, UNSAFE_RouteContext as RouteContext } from 'react-router';
import { Route, Routes } from 'react-router-dom';

import { OnlyAuthed } from '../components/OnlyAuthed';
import { VaultLayout } from '../components/VaultLayout/VaultLayout';
import { UserAppProvider } from '../hooks/useUserApp';
import { DailyNotePage } from '../pages/DailyNotePage';
import { NoteStackPage } from '../pages/NotePage';
import { NotesPage } from '../pages/NotesPage/NotesPage';
import { VaultsPage } from '../pages/VaultsPage/VaultsPage';
import { PATHS } from '../paths';

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

export const VaultAppRoute = () => {
  return (
    <UserAppProvider>
      <OnlyAuthed>
        <VaultLayout>
          <RootRoutes>
            <Route path={PATHS.VAULT_DAILY_PATH} element={<DailyNotePage />} />
            <Route path={PATHS.VAULT_NOTE_PATH} element={<NoteStackPage />} />
            <Route path={PATHS.VAULT_NOTE_INDEX_PATH} element={<NotesPage />} />
          </RootRoutes>
        </VaultLayout>

        <RootRoutes>
          <Route path={PATHS.VAULT_INDEX_PATH} element={<VaultsPage />} />
        </RootRoutes>
      </OnlyAuthed>
    </UserAppProvider>
  );
};

export default VaultAppRoute;
