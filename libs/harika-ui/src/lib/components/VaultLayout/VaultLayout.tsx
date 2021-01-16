import { HarikaVaults, Vault } from '@harika/harika-core';
import {
  CurrentNoteContext,
  CurrentVaultContext,
  ICurrentNoteState,
  useCurrentVault,
} from '@harika/harika-utils';
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { cn } from '../../utils';
import { Header } from '../Header/Header';
import { Sidebar } from '../Sidebar/Sidebar';

import './styles.css';

const layoutClass = cn('vault-layout');

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

export const VaultLayout: React.FC<{
  vaults: HarikaVaults;
}> = ({ children, vaults }) => {
  const { vaultId } = useParams<{ vaultId: string }>();

  const [vault, setVault] = useState<Vault | undefined>();

  const currentNoteActions = useState<ICurrentNoteState>();
  const [isSidebarOpened, setIsSidebarOpened] = useState(true);

  const handleTogglerClick = useCallback(() => {
    setIsSidebarOpened(!isSidebarOpened);
  }, [isSidebarOpened]);

  useEffect(() => {
    const cb = async () => setVault(await vaults.getVault(vaultId));

    cb();
  }, [vaults, vaultId]);

  if (!vault) return null;

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
