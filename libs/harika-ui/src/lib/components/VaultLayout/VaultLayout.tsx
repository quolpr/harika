import { HarikaVaults } from '@harika/harika-core';
import {
  CurrentNoteContext,
  CurrentVaultContext,
  ICurrentNoteState,
  useCurrentVault,
} from '@harika/harika-utils';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '../../utils';
import { Header } from '../Header/Header';
import { Sidebar } from '../Sidebar/Sidebar';

import './styles.css';

const layoutClass = cn('vault-layout');

const vaults = new HarikaVaults(
  ({ schema, dbName }) =>
    new LokiJSAdapter({
      schema,
      dbName, // optional db name
      // migrations, // optional migrations
      useWebWorker: false, // recommended for new projects. tends to improve performance and reduce glitches in most cases, but also has downsides - test with and without it
      useIncrementalIndexedDB: true, // recommended for new projects. improves performance (but incompatible with early Watermelon databases)
      // It's recommended you implement this method:
      // onIndexedDBVersionChange: () => {
      //   // database was deleted in another browser tab (user logged out), so we must make sure we delete
      //   // it in this tab as well
      //   if (checkIfUserIsLoggedIn()) {
      //     window.location.reload()
      //   }
      // },
      // Optional:
      // onQuotaExceededError: (error) => { /* do something when user runs out of disk space */ },
    } as any)
);

const Syncher: React.FC = ({ children }) => {
  const vault = useCurrentVault();
  const [wasSynched, setWasSynched] = useState(false);

  useEffect(() => {
    const callback = async () => {
      await vault.sync();

      setWasSynched(true);
    };

    callback();
  }, [vault]);

  return <>{wasSynched && children}</>;
};

export const VaultLayout: React.FC<{ vaultId: string }> = ({
  children,
  vaultId,
}) => {
  const vault = vaults.getVault(vaultId);

  const currentNoteActions = useState<ICurrentNoteState>();
  const [isSidebarOpened, setIsSidebarOpened] = useState(true);

  const handleTogglerClick = useCallback(() => {
    setIsSidebarOpened(!isSidebarOpened);
  }, [isSidebarOpened]);

  return (
    <CurrentVaultContext.Provider value={vault}>
      <CurrentNoteContext.Provider value={currentNoteActions}>
        <Syncher>
          <div className={layoutClass()}>
            <Sidebar
              className={layoutClass('sidebar', {
                closed: !isSidebarOpened,
              })}
              isOpened={isSidebarOpened}
            />

            <div className={layoutClass('container')}>
              <div className={layoutClass('header-wrapper')}>
                <Header
                  className={layoutClass('header')}
                  onTogglerClick={handleTogglerClick}
                  isTogglerToggled={isSidebarOpened}
                />
              </div>

              <div className={layoutClass('main-wrapper')}>
                <section
                  className={layoutClass('main', {
                    'sidebar-opened': isSidebarOpened,
                  })}
                >
                  {children}
                </section>
              </div>
            </div>
          </div>
        </Syncher>
      </CurrentNoteContext.Provider>
    </CurrentVaultContext.Provider>
  );
};
