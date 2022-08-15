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
import { createGlobalStyle } from 'styled-components';
import { css, styled } from 'twin.macro';
import tw from 'twin.macro';

import { FooterRefContext } from '../../contexts/FooterRefContext';
import { FocusedStackIdContext } from '../../contexts/StackedNotesContext';
import { useLoadUserAppCallback } from '../../hooks/useUserApp';
import { CurrentVaultAppContext } from '../../hooks/vaultAppHooks';
import { bem, useNavigateRef } from '../../utils';
import { UndoRedoManagerProvider } from '../UndoRedoManagerProvider';
import { VaultHeader } from '../VaultHeader/VaultHeader';
import {
  getLocalStorageSidebarWidth,
  VaultSidebar,
} from '../VaultSidebar/VaultSidebar';

const GlobalStyle = createGlobalStyle`
  .react-calendar {
    margin: 0 auto;
    ${tw`mt-8`}
  }

  :root {
    --sidebar-width: 260px;
  }
`;

const VaultContainer = styled.div<{ withPadding: boolean }>`
  width: 100%;
  margin-left: 0px;
  position: relative;

  transition: var(--layout-animation, all 0.15s cubic-bezier(0.4, 0, 0.2, 1));

  ${({ withPadding }) =>
    withPadding &&
    css`
      @media (min-width: 768px) {
        margin-left: var(--sidebar-width);
      }
    `}
`;

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

const VaultLayoutStyled = styled.div`
  display: flex;
  position: relative;

  width: 100%;
  height: 100%;
`;

const HeaderWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const MainWrapper = styled.div`
  position: absolute;

  top: var(--vault-header-full-height);
  bottom: var(--vault-footer-height);

  -webkit-overflow-scrolling: touch;
  overflow-y: scroll;
  overflow-x: hidden;
  scroll-behavior: smooth;

  overscroll-behavior: contain;

  width: 100%;
  display: flex;
  justify-content: center;
`;

const Main = styled.section`
  ${tw`transition-all px-8`}

  width: 100%;

  @media (min-width: 768px) {
    ${tw`px-10`}
  }
`;

const FooterWrapper = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
`;

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

  // TODO: race condition may happen here on dispose
  useEffect(() => {
    if (!vaultId) return;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    let closeDevtool = () => {};
    let vaultApp: VaultApplication | undefined = undefined;

    const cb = async () => {
      vaultApp = new VaultApplication(vaultId, {
        base: import.meta.env.VITE_PUBLIC_WS_BASE as string,
        path: import.meta.env.VITE_PUBLIC_WS_PATH as string,
        apiUrl: import.meta.env.VITE_PUBLIC_API_URL as string,
      });

      if (!vaultApp) {
        writeStorage('lastVaultId', undefined);

        navigate.current('/');

        return;
      } else {
        await vaultApp.start();

        mounted() && setVaultApp(vaultApp);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if ((window as any).__REDUX_DEVTOOLS_EXTENSION__) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

    void cb();

    return () => {
      vaultApp?.stop();
      setVaultApp(undefined);
      closeDevtool();
    };
  }, [loadUserApp, mounted, navigate, vaultId]);

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
    const root = document.documentElement;
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
    <>
      <GlobalStyle />
      <FocusedStackIdContext.Provider value={focusedStackContextValue}>
        <CurrentVaultAppContext.Provider value={vaultApp}>
          <FooterRefContext.Provider value={footerRef}>
            <UndoRedoManagerProvider>
              <VaultLayoutStyled className={layoutClass()}>
                <VaultSidebar
                  vaultName={vaultName}
                  ref={sidebarRef}
                  isOpened={isSidebarOpened}
                  onNavClick={closeSidebar}
                />

                <VaultContainer
                  className={layoutClass('container', {
                    'with-padding': isSidebarOpened,
                  })}
                  withPadding={isSidebarOpened}
                >
                  <HeaderWrapper className={layoutClass('header-wrapper')}>
                    <VaultHeader
                      onTogglerClick={handleTogglerClick}
                      isTogglerToggled={isSidebarOpened}
                      togglerRef={togglerRef}
                    />
                  </HeaderWrapper>

                  <MainWrapper
                    className={layoutClass('main-wrapper')}
                    onScroll={handleScroll}
                    ref={mainRef}
                  >
                    <Main
                      className={layoutClass('main', {
                        'sidebar-opened': isSidebarOpened,
                      })}
                    >
                      {children}
                    </Main>
                  </MainWrapper>

                  <FooterWrapper
                    className={layoutClass('footer-wrapper')}
                    ref={footerRef}
                  ></FooterWrapper>
                </VaultContainer>
              </VaultLayoutStyled>
            </UndoRedoManagerProvider>
          </FooterRefContext.Provider>
        </CurrentVaultAppContext.Provider>
      </FocusedStackIdContext.Provider>
    </>
  );
};

export default VaultLayout;
