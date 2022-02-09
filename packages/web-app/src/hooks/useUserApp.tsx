import { UserApplication } from '@harika/web-core';
import React, { useEffect, useRef } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useGetSyncToken } from './useGetSyncToken';
import { useSyncConfig } from './useSyncConfig';

type IState = {
  app: UserApplication | undefined;
  isLoading: boolean;
};

export const UserAppContext = createContext<{
  state: IState;
  setState: (state: IState) => void;
}>({ state: { app: undefined, isLoading: false }, setState: () => undefined });

export const useLoadUserAppCallback = () => {
  const ctx = useContext(UserAppContext);
  const { userId, isOffline } = useSyncConfig();
  const getSyncToken = useGetSyncToken();

  const cb = useCallback(async () => {
    if (ctx.state.app) return ctx.state.app;

    // TODO: better return promise that is loading
    if (ctx.state.isLoading) return;

    if (!userId || isOffline === undefined) return;

    ctx.setState({ app: undefined, isLoading: true });

    const app = new UserApplication(
      userId.replace(/-/g, ''),
      import.meta.env.VITE_PUBLIC_WS_URL as string,
      getSyncToken,
    );
    await app.start();

    ctx.setState({ app: app, isLoading: false });

    return app;
  }, [ctx, getSyncToken, isOffline, userId]);

  const cbRef = useRef(cb);

  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);

  return cbRef;
};

export const useLoadUserApp = () => {
  const cb = useLoadUserAppCallback();

  useEffect(() => {
    cb.current();
  }, [cb]);
};

export const UserAppProvider: React.FC = ({ children }) => {
  const [state, setState] = useState<IState>({
    app: undefined,
    isLoading: false,
  });

  const toProvide = useMemo(() => ({ state, setState }), [state]);

  return (
    <UserAppContext.Provider value={toProvide}>
      {children}
    </UserAppContext.Provider>
  );
};

export const useUserApp = () => {
  return useContext(UserAppContext).state.app;
};

export const useUserVaults = () => {
  return useContext(UserAppContext).state.app?.getVaultsService();
};
