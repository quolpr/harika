import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { useClickAway, useMedia, useMountedState } from 'react-use';
import { VaultHeader } from '../VaultHeader/VaultHeader';
import { VaultSidebar } from '../VaultSidebar/VaultSidebar';

import './styles.css';
import { writeStorage } from '@rehooks/local-storage';
import { FooterRefContext } from '../../contexts/FooterRefContext';
import { LoadingDoneSubjectContext } from '../../contexts';
import { Observable } from 'rxjs';
import { mapTo, switchMap, take, tap } from 'rxjs/operators';
import { bem } from '../../utils';
import { UndoRedoManagerProvider } from '../UndoRedoManagerProvider';
import { UserApplication, VaultApplication } from '@harika/web-core';
import { CurrentVaultAppContext } from '../../hooks/vaultAppHooks';
import { useLoadUserAppCallback } from '../../hooks/useUserApp';
import { useSyncConfig } from '../../hooks/useSyncConfig';
import { CustomScrollbar } from '../CustomScrollbar';

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
  const history = useHistory();
  const location = useLocation();
  const loadingDoneSubject = useContext(LoadingDoneSubjectContext);

  const mainRef = useRef<HTMLDivElement>(null);
  const scrollHistory = useRef<Record<string, number>>({});

  const listenScroll = useRef(true);

  useEffect(() => {
    const scrollPosHistory$ = new Observable<number>((observer) => {
      return history.listen((ev, act) => {
        observer.next(
          (() => {
            if (ev.key && scrollHistory.current[ev.key] && act === 'POP') {
              return scrollHistory.current[ev.key];
            } else {
              return 0;
            }
          })(),
        );
      });
    });

    const pipe = scrollPosHistory$
      .pipe(
        tap(() => (listenScroll.current = false)),
        switchMap((val) => loadingDoneSubject.pipe(take(1), mapTo(val))),
        tap((val) => {
          mainRef.current?.scrollTo({
            top: val,
            // https://github.com/Microsoft/TypeScript/issues/28755
            behavior: 'instant' as 'auto',
          });
        }),
        tap(() => (listenScroll.current = true)),
      )
      .subscribe();

    return () => pipe.unsubscribe();
  }, [history, loadingDoneSubject]);

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
  const { syncConfig } = useSyncConfig();
  const history = useHistory();
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

  // TODO: race condition may happen here on dispose
  useEffect(() => {
    if (!syncConfig) return;

    let closeDevtool = () => {};
    let vaultApp: VaultApplication | undefined = undefined;

    const cb = async () => {
      vaultApp = new VaultApplication(vaultId, syncConfig);

      if (!vaultApp) {
        writeStorage('lastVaultId', undefined);

        history.replace('/');

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
  }, [vaultId, history, syncConfig, loadUserApp, mounted]);

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

  if (!vaultApp) return null;

  return (
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
  );
};

export default VaultLayout;
