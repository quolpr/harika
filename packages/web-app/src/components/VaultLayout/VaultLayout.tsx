import type { UserApp, VaultApp } from '@harika/web-core';
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { useClickAway, useMedia } from 'react-use';
import { NotesServiceContext } from '../../contexts/CurrentNotesServiceContext';
import { CurrentVaultAppContext } from '../../contexts/CurrentVaultContext';
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

export const VaultLayout: React.FC<{
  vaultService: UserApp;
}> = ({ children, vaultService }) => {
  const history = useHistory();
  const { vaultId } = useParams<{ vaultId: string }>();
  const isWide = useMedia('(min-width: 768px)');
  const [notesService, setNotesRepo] = useState<VaultApp | undefined>();
  const [isSidebarOpened, setIsSidebarOpened] = useState(isWide);

  const togglerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const handleTogglerClick = useCallback(() => {
    setIsSidebarOpened(!isSidebarOpened);
  }, [isSidebarOpened]);

  useEffect(() => {
    let closeDevtool = () => {};

    const cb = async () => {
      const repo = await vaultService.getNotesService(vaultId);

      if (!repo) {
        writeStorage('lastVaultId', undefined);

        history.replace('/');

        return;
      } else {
        setNotesRepo(repo);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).__REDUX_DEVTOOLS_EXTENSION__) {
          closeDevtool = await (
            await import('../../connectReduxDevtool')
          ).connect(repo.vault, `Vault ${repo.vault.name}`);
        }

        if (import.meta.env.MODE === 'production') {
          (await import('../../connectSentry')).connectSentry(repo.vault);
        }
      }
    };

    cb();

    return () => {
      vaultService.closeNotesRepo(vaultId);

      setNotesRepo(undefined);
      closeDevtool();
    };
  }, [vaultService, vaultId, history]);

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

  if (!notesService) return null;

  return (
    <CurrentVaultAppContext.Provider value={notesService.vault}>
      <NotesServiceContext.Provider value={notesService}>
        <FooterRefContext.Provider value={footerRef}>
          <UndoRedoManagerProvider notesService={notesService}>
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
          </UndoRedoManagerProvider>
        </FooterRefContext.Provider>
      </NotesServiceContext.Provider>
    </CurrentVaultAppContext.Provider>
  );
};

export default VaultLayout;
