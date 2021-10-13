import React, { useEffect, useMemo, useState } from 'react';
import { Switch, Route } from 'react-router-dom';
import { VaultLayout } from '../components/VaultLayout/VaultLayout';
import { PATHS, VAULT_PREFIX } from '../paths';
import { useAuthState } from '../hooks/useAuthState';
import { OnlyAuthed } from '../components/OnlyAuthed';
import { DailyNotePage } from '../pages/DailyNotePage';
import { NotePage } from '../pages/NotePage';
import { NotesPage } from '../pages/NotesPage/NotesPage';
import { VaultsPage } from '../pages/VaultsPage/VaultsPage';
import { UserApplication } from '@harika/web-core';

export const VaultAppRoute = () => {
  const [authInfo] = useAuthState();
  const [userApplication, setUserApplication] = useState<
    UserApplication | undefined
  >();

  const userId = authInfo?.userId;
  const isOffline = authInfo?.isOffline;
  const authToken = authInfo?.authToken;

  const syncConfig = useMemo(() => {
    return authToken
      ? {
          url: import.meta.env.VITE_PUBLIC_WS_URL as string,
          authToken,
        }
      : undefined;
  }, [authToken]);

  useEffect(() => {
    if (!userId || isOffline === undefined || !syncConfig) return;
    let service: UserApplication | undefined = undefined;
    const cb = async () => {
      service = new UserApplication(userId.replace(/\-/g, ''), syncConfig);

      await service.start();

      setUserApplication(service);
    };
    cb();
    return () => {
      service?.stop();
      setUserApplication(undefined);
    };
  }, [userId, isOffline, authToken]);

  return (
    <>
      <Route path={VAULT_PREFIX}>
        <OnlyAuthed>
          <VaultLayout userApp={userApplication} syncConfig={syncConfig}>
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
          {userApplication && (
            <VaultsPage vaultsService={userApplication.getVaultsService()} />
          )}
        </OnlyAuthed>
      </Route>
    </>
  );
};

export default VaultAppRoute;
