import React, { useEffect, useRef } from 'react';
import { UserApplication } from '@harika/web-core';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
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
  const { syncConfig, userId, isOffline } = useSyncConfig();

  const cb = useCallback(async () => {
    if (ctx.state.isLoading || ctx.state.app) return;
    if (!userId || isOffline === undefined || !syncConfig) return;

    ctx.setState({ app: undefined, isLoading: true });

    const app = new UserApplication(userId.replace(/-/g, ''), syncConfig);
    await app.start();

    ctx.setState({ app: app, isLoading: false });

    return app;
  }, [ctx, isOffline, syncConfig, userId]);

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
