import React from 'react';
import { Switch, Route } from 'react-router-dom';
import { VaultLayout } from '../components/VaultLayout/VaultLayout';
import { PATHS, VAULT_PREFIX } from '../paths';
import { OnlyAuthed } from '../components/OnlyAuthed';
import { DailyNotePage } from '../pages/DailyNotePage';
import { NotePage } from '../pages/NotePage';
import { NotesPage } from '../pages/NotesPage/NotesPage';
import { VaultsPage } from '../pages/VaultsPage/VaultsPage';
import { UserAppProvider } from '../hooks/useUserApp';

export const VaultAppRoute = () => {
  return (
    <UserAppProvider>
      <Route path={VAULT_PREFIX}>
        <OnlyAuthed>
          <VaultLayout>
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
        </OnlyAuthed>
      </Route>
      <Route exact path={PATHS.VAULT_INDEX_PATH}>
        <OnlyAuthed>
          <VaultsPage />
        </OnlyAuthed>
      </Route>
    </UserAppProvider>
  );
};

export default VaultAppRoute;
