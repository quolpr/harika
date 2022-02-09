import { useMemo } from 'react';

import { useAuthState } from './useAuthState';

export const useSyncConfig = () => {
  const [authInfo] = useAuthState();
  const userId = authInfo?.userId;
  const isOffline = authInfo?.isOffline;

  return useMemo(() => {
    return {
      userId,
      isOffline,
    };
  }, [isOffline, userId]);
};
