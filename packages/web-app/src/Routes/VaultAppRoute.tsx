import React, { useEffect, useState } from 'react';
import { Switch, Route } from 'react-router-dom';
import { VaultLayout } from '../components/VaultLayout/VaultLayout';
import { PATHS, VAULT_PREFIX } from '../paths';
import { VaultsRepository } from '@harika/web-core';
import { useAuthState } from '../hooks/useAuthState';
import { OnlyAuthed } from '../components/OnlyAuthed';
import { DailyNotePage } from '../pages/DailyNotePage';
import { NotePage } from '../pages/NotePage';
import { NotesPage } from '../pages/NotesPage/NotesPage';
import { VaultsPage } from '../pages/VaultsPage/VaultsPage';

export const VaultAppRoute = () => {
  const [authInfo] = useAuthState();
  const [vaultRepository, setVaultRepository] =
    useState<VaultsRepository | undefined>();

  const userId = authInfo?.userId;
  const isOffline = authInfo?.isOffline;

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

  return (
    <>
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
    </>
  );
};

export default VaultAppRoute;
