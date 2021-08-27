import React, { useEffect, useState } from 'react';
import { Switch, Route } from 'react-router-dom';
import { VaultLayout } from '../components/VaultLayout/VaultLayout';
import { PATHS, VAULT_PREFIX } from '../paths';
import { VaultsService } from '@harika/web-core';
import { useAuthState } from '../hooks/useAuthState';
import { OnlyAuthed } from '../components/OnlyAuthed';
import { DailyNotePage } from '../pages/DailyNotePage';
import { NotePage } from '../pages/NotePage';
import { NotesPage } from '../pages/NotesPage/NotesPage';
import { VaultsPage } from '../pages/VaultsPage/VaultsPage';

export const VaultAppRoute = () => {
  const [authInfo] = useAuthState();
  const [vaultService, setVaultService] = useState<VaultsService | undefined>();

  const userId = authInfo?.userId;
  const isOffline = authInfo?.isOffline;
  const authToken = authInfo?.authToken;

  useEffect(() => {
    if (!userId || isOffline === undefined || !authToken) return;

    let service: VaultsService | undefined = undefined;

    const cb = async () => {
      service = new VaultsService(userId, !isOffline, {
        wsUrl: import.meta.env.SNOWPACK_PUBLIC_WS_URL,
        authToken: authToken,
      });

      await service.init();

      setVaultService(service);
    };

    cb();

    return () => {
      service?.close();
      setVaultService(undefined);
    };
  }, [userId, isOffline, authToken]);

  return (
    <>
      <Route path={VAULT_PREFIX}>
        <OnlyAuthed>
          {vaultService && (
            <VaultLayout vaultService={vaultService}>
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
          {vaultService && <VaultsPage vaults={vaultService} />}
        </OnlyAuthed>
      </Route>
    </>
  );
};

export default VaultAppRoute;
