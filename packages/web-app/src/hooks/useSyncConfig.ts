import { useMemo } from 'react';
import { useAuthState } from './useAuthState';

export const useSyncConfig = () => {
  const [authInfo] = useAuthState();
  const authToken = authInfo?.authToken;
  const userId = authInfo?.userId;
  const isOffline = authInfo?.isOffline;

  return useMemo(() => {
    return {
      syncConfig: authToken
        ? {
            url: import.meta.env.VITE_PUBLIC_WS_URL as string,
            authToken,
          }
        : undefined,
      userId,
      isOffline,
    };
  }, [authToken, isOffline, userId]);
};
