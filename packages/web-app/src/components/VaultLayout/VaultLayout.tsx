import './styles.css';

import { VaultApplication } from '@harika/web-core';
import { writeStorage } from '@rehooks/local-storage';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useClickAway, useMedia, useMountedState } from 'react-use';

import { FooterRefContext } from '../../contexts/FooterRefContext';
import { FocusedStackIdContext } from '../../contexts/StackedNotesContext';
import { useGetSyncToken } from '../../hooks/useGetSyncToken';
import { useLoadUserAppCallback } from '../../hooks/useUserApp';
import { CurrentVaultAppContext } from '../../hooks/vaultAppHooks';
import { bem, useNavigateRef } from '../../utils';
import { UndoRedoManagerProvider } from '../UndoRedoManagerProvider';
import { VaultHeader } from '../VaultHeader/VaultHeader';
import {
  getLocalStorageSidebarWidth,
  VaultSidebar,
} from '../VaultSidebar/VaultSidebar';

const layoutClass = bem('vault-layout');

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
  // const navigate = useNavigateRef();
  const location = useLocation();
  // const loadingDoneSubject = useContext(LoadingDoneSubjectContext);

  const mainRef = useRef<HTMLDivElement>(null);
  const scrollHistory = useRef<Record<string, number>>({});

  const listenScroll = useRef(true);

  // TODO: after upgrade to react-router-v6 we need to refactor to stop using history.listen
  // useEffect(() => {
  //   const scrollPosHistory$ = new Observable<number>((observer) => {
  //     return history.listen((ev, act) => {
  //       observer.next(
  //         (() => {
  //           if (ev.key && scrollHistory.current[ev.key] && act === 'POP') {
  //             return scrollHistory.current[ev.key];
  //           } else {
  //             return 0;
  //           }
  //         })(),
  //       );
  //     });
  //   });

  //   const pipe = scrollPosHistory$
  //     .pipe(
  //       tap(() => (listenScroll.current = false)),
  //       switchMap((val) => loadingDoneSubject.pipe(take(1), mapTo(val))),
  //       tap((val) => {
  //         mainRef.current?.scrollTo({
  //           top: val,
  //           // https://github.com/Microsoft/TypeScript/issues/28755
  //           behavior: 'instant' as 'auto',
  //         });
  //       }),
  //       tap(() => (listenScroll.current = true)),
  //     )
  //     .subscribe();

  //   return () => pipe.unsubscribe();
  // }, [history, loadingDoneSubject]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!location.key) return;
      if (!listenScroll.current) return;

      scrollHistory.current[location.key] = e.currentTarget.scrollTop;
    },
    [location.key],
  );

  return { mainRef, handleScroll };
};

export const VaultLayout: React.FC = ({ children }) => {
  const navigate = useNavigateRef();
  const { vaultId } = useParams<{ vaultId: string }>();
  const isWide = useMedia('(min-width: 768px)');
  const [vaultApp, setVaultApp] = useState<VaultApplication | undefined>();
  const [isSidebarOpened, setIsSidebarOpened] = useState(isWide);

  const togglerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const handleTogglerClick = useCallback(() => {
    setIsSidebarOpened(!isSidebarOpened);
  }, [isSidebarOpened]);

  const [vaultName, setVaultName] = useState<undefined | string>(undefined);

  const loadUserApp = useLoadUserAppCallback();

  const mounted = useMountedState();
  const getSyncToken = useGetSyncToken();

  // TODO: race condition may happen here on dispose
  useEffect(() => {
    if (!vaultId) return;

    let closeDevtool = () => {};
    let vaultApp: VaultApplication | undefined = undefined;

    const cb = async () => {
      vaultApp = new VaultApplication(
        vaultId,
        import.meta.env.VITE_PUBLIC_WS_URL as string,
        getSyncToken,
      );

      if (!vaultApp) {
        writeStorage('lastVaultId', undefined);

        navigate.current('/');

        return;
      } else {
        await vaultApp.start();

        mounted() && setVaultApp(vaultApp);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).__REDUX_DEVTOOLS_EXTENSION__) {
          closeDevtool = await (
            await import('../../connectReduxDevtool')
          ).connect(
            vaultApp.getRootStore(),
            `Vault ${vaultApp.applicationName}`,
          );
        }

        if (import.meta.env.MODE === 'production') {
          (await import('../../connectSentry')).connectSentry(
            vaultApp.getRootStore(),
          );
        }
      }

      setTimeout(async () => {
        const userApp = await loadUserApp.current();

        mounted() &&
          setVaultName(
            (await userApp?.getVaultsService().getVault(vaultId))?.name,
          );
      }, 500);
    };

    cb();

    return () => {
      vaultApp?.stop();
      setVaultApp(undefined);
      closeDevtool();
    };
  }, [vaultId, loadUserApp, mounted, getSyncToken, navigate]);

  // TODO: reset focused block on page change

  const closeSidebar = useCallback(
    (e: React.MouseEvent | Event) => {
      if (togglerRef.current?.contains(e.target as Node)) return;

      !isWide && isSidebarOpened && setIsSidebarOpened(false);
    },
    [isWide, isSidebarOpened, setIsSidebarOpened],
  );

  useClickAway(sidebarRef, closeSidebar);

  useEffect(() => {
    writeStorage('lastVaultId', vaultId);
  }, [vaultId]);

  const { mainRef, handleScroll } = useKeepScroll();

  useLayoutEffect(() => {
    // To avoid flickering on sidebar appear
    let root = document.documentElement;
    root.style.setProperty(
      '--sidebar-width',
      `${getLocalStorageSidebarWidth()}px`,
    );
  }, []);

  const [focusedStackId, setFocusedStackId] = useState<string | undefined>();
  const focusedStackContextValue = useMemo(
    () => ({ stackId: focusedStackId, setStackId: setFocusedStackId }),
    [focusedStackId],
  );

  if (!vaultApp) return null;

  return (
    <FocusedStackIdContext.Provider value={focusedStackContextValue}>
      <CurrentVaultAppContext.Provider value={vaultApp}>
        <FooterRefContext.Provider value={footerRef}>
          <UndoRedoManagerProvider>
            <div className={layoutClass()}>
              <VaultSidebar
                vaultName={vaultName}
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
          </UndoRedoManagerProvider>
        </FooterRefContext.Provider>
      </CurrentVaultAppContext.Provider>
    </FocusedStackIdContext.Provider>
  );
};

export default VaultLayout;
