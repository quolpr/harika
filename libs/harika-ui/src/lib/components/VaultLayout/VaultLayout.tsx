import { VaultRepository, Vault, VaultUiState } from '@harika/harika-core';
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { NoteRepositoryContext } from '../../contexts/CurrentNoteRepositoryContext';
import { CurrentVaultContext } from '../../contexts/CurrentVaultContext';
import { CurrentVaultUiStateContext } from '../../contexts/CurrentVaultUiStateContext';
import { cn } from '../../utils';
import { Header } from '../Header/Header';
import { Sidebar } from '../Sidebar/Sidebar';

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
  const [vault, setVault] = useState<Vault | undefined>();
  const [isSidebarOpened, setIsSidebarOpened] = useState(true);

  const handleTogglerClick = useCallback(() => {
    setIsSidebarOpened(!isSidebarOpened);
  }, [isSidebarOpened]);

  useEffect(() => {
    const cb = async () => setVault(await vaultRepository.getVault(vaultId));

    cb();
  }, [vaultRepository, vaultId]);

  const [vaultUiState] = useState(new VaultUiState({}));

  // TODO: reset focused block on page change

  if (!vault) return null;

  return (
    <CurrentVaultUiStateContext.Provider value={vaultUiState}>
      <CurrentVaultContext.Provider value={vault}>
        <NoteRepositoryContext.Provider
          value={vaultRepository.getNoteRepository()}
        >
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
        </NoteRepositoryContext.Provider>
      </CurrentVaultContext.Provider>
    </CurrentVaultUiStateContext.Provider>
  );
};
