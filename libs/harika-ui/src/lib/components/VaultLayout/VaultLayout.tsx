import {
  VaultsRepository,
  VaultModel,
  VaultUiState,
} from '@harika/harika-front-core';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
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
import { writeStorage } from '@rehooks/local-storage';
import { FooterRefContext } from '../../contexts/FooterRefContext';

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

// Keep scroll position when back/forward borwser button hits
const useKeepScroll = () => {
  const history = useHistory();
  const location = useLocation();

  const mainRef = useRef<HTMLDivElement>(null);
  const scrollHistory = useRef<Record<string, number>>({});

  const listenScroll = useRef(true);

  useEffect(() => {
    return history.listen((ev, act) => {
      listenScroll.current = false;
      setTimeout(() => {
        const top = (() => {
          if (ev.key && scrollHistory.current[ev.key] && act === 'POP') {
            return scrollHistory.current[ev.key];
          } else {
            return 0;
          }
        })();

        mainRef.current?.scrollTo({
          top,
          // https://github.com/Microsoft/TypeScript/issues/28755
          behavior: 'instant' as 'auto',
        });

        listenScroll.current = true;
      }, 0);
    });
  }, [history]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!location.key) return;
      if (!listenScroll.current) return;

      scrollHistory.current[location.key] = e.currentTarget.scrollTop;
    },
    [location.key]
  );

  return { mainRef, handleScroll };
};

export const VaultLayout: React.FC<{
  vaultRepository: VaultsRepository;
}> = ({ children, vaultRepository }) => {
  const history = useHistory();
  const { vaultId } = useParams<{ vaultId: string }>();
  const isWide = useMedia('(min-width: 768px)');
  const [vault, setVault] = useState<VaultModel | undefined>();
  const [isSidebarOpened, setIsSidebarOpened] = useState(isWide);

  const togglerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const handleTogglerClick = useCallback(() => {
    setIsSidebarOpened(!isSidebarOpened);
  }, [isSidebarOpened]);

  useEffect(() => {
    const cb = async () => {
      const vault = await vaultRepository.getVault(vaultId);

      if (!vault) {
        writeStorage('lastVaultId', undefined);

        history.replace('/');
      }

      setVault(vault);
    };

    cb();
  }, [vaultRepository, vaultId, history]);

  const [vaultUiState] = useState(new VaultUiState({}));

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__REDUX_DEVTOOLS_EXTENSION__) {
      const connection = remotedev.connectViaExtension({
        name: `Vault UI`,
      });

      connectReduxDevTools(remotedev, connection, vaultUiState);
    }
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

  useEffect(() => {
    writeStorage('lastVaultId', vaultId);
  }, [vaultId]);

  const { mainRef, handleScroll } = useKeepScroll();

  if (!vault) return null;

  return (
    <CurrentVaultUiStateContext.Provider value={vaultUiState}>
      <CurrentVaultContext.Provider value={vault}>
        <NoteRepositoryContext.Provider
          value={vaultRepository.getNoteRepository()}
        >
          <FooterRefContext.Provider value={footerRef}>
            <div className={layoutClass()}>
              <VaultSidebar
                ref={sidebarRef}
                className={layoutClass('sidebar', {
                  closed: !isSidebarOpened,
                })}
                isOpened={isSidebarOpened}
                onNavClick={closeSidebar}
              />

              <div
                className={layoutClass('container', {
                  'with-padding': isSidebarOpened,
                })}
              >
                <div className={layoutClass('header-wrapper')}>
                  <VaultHeader
                    className={layoutClass('header')}
                    onTogglerClick={handleTogglerClick}
                    isTogglerToggled={isSidebarOpened}
                    togglerRef={togglerRef}
                  />
                </div>

                <div
                  className={layoutClass('main-wrapper')}
                  onScroll={handleScroll}
                  ref={mainRef}
                >
                  <section
                    className={layoutClass('main', {
                      'sidebar-opened': isSidebarOpened,
                    })}
                  >
                    {children}
                  </section>
                </div>

                <div
                  className={layoutClass('footer-wrapper')}
                  ref={footerRef}
                ></div>
              </div>
            </div>
          </FooterRefContext.Provider>
        </NoteRepositoryContext.Provider>
      </CurrentVaultContext.Provider>
    </CurrentVaultUiStateContext.Provider>
  );
};
