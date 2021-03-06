import { VaultRepository, Vault, VaultUiState } from '@harika/harika-core';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useClickAway, useMedia } from 'react-use';
import { NoteRepositoryContext } from '../../contexts/CurrentNoteRepositoryContext';
import { CurrentVaultContext } from '../../contexts/CurrentVaultContext';
import { CurrentVaultUiStateContext } from '../../contexts/CurrentVaultUiStateContext';
import { cn } from '../../utils';
import { VaultHeader } from '../VaultHeader/VaultHeader';
import { VaultSidebar } from '../VaultSidebar/VaultSidebar';
import * as remotedev from 'remotedev';
import { connectReduxDevTools } from 'mobx-keystone';

import './styles.css';

const layoutClass = cn('vault-layout');

// const Syncher: React.FC = ({ children }) => {
//   const vault = useCurrentVault();
//   const [wasSynched, setWasSynched] = useState(false);
//
//   useEffect(() => {
//     const callback = async () => {
//       await vault.sync();
//
//       setWasSynched(true);
//     };
//
//     callback();
//   }, [vault]);
//
//   return <>{wasSynched && children}</>;
// };

export const VaultLayout: React.FC<{
  vaultRepository: VaultRepository;
}> = ({ children, vaultRepository }) => {
  const { vaultId } = useParams<{ vaultId: string }>();
  const isWide = useMedia('(min-width: 768px)');
  const [vault, setVault] = useState<Vault | undefined>();
  const [isSidebarOpened, setIsSidebarOpened] = useState(isWide);

  const togglerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleTogglerClick = useCallback(() => {
    setIsSidebarOpened(!isSidebarOpened);
  }, [isSidebarOpened]);

  useEffect(() => {
    const cb = async () => setVault(await vaultRepository.getVault(vaultId));

    cb();
  }, [vaultRepository, vaultId]);

  const [vaultUiState] = useState(new VaultUiState({}));

  useEffect(() => {
    const connection = remotedev.connectViaExtension({
      name: `Vault UI`,
    });

    connectReduxDevTools(remotedev, connection, vaultUiState);
  }, [vaultUiState]);

  // TODO: reset focused block on page change

  const closeSidebar = useCallback(
    (e: React.MouseEvent | Event) => {
      if (togglerRef.current?.contains(e.target as Node)) return;

      !isWide && isSidebarOpened && setIsSidebarOpened(false);
    },
    [isWide, isSidebarOpened, setIsSidebarOpened]
  );

  useClickAway(sidebarRef, closeSidebar);

  if (!vault) return null;

  return (
    <CurrentVaultUiStateContext.Provider value={vaultUiState}>
      <CurrentVaultContext.Provider value={vault}>
        <NoteRepositoryContext.Provider
          value={vaultRepository.getNoteRepository()}
        >
          <div className={layoutClass()}>
            <VaultSidebar
              ref={sidebarRef}
              className={layoutClass('sidebar', {
                closed: !isSidebarOpened,
              })}
              isOpened={isSidebarOpened}
              onNavClick={closeSidebar}
            />

            <div className={layoutClass('container')}>
              <div className={layoutClass('header-wrapper')}>
                <VaultHeader
                  className={layoutClass('header')}
                  onTogglerClick={handleTogglerClick}
                  isTogglerToggled={isSidebarOpened}
                  togglerRef={togglerRef}
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
        </NoteRepositoryContext.Provider>
      </CurrentVaultContext.Provider>
    </CurrentVaultUiStateContext.Provider>
  );
};
