import {
  deleteFromStorage,
  useLocalStorage,
  writeStorage,
} from '@rehooks/local-storage';
import axios from 'axios';
import { useCallback, useEffect } from 'react';

import { oryClient } from '../oryClient';

export interface AuthInfo {
  userId: string;
  isOffline: boolean;
}

export const authStorageKey = 'auth';

// TODO: maybe mobx localstorage?
export const useAuthState = (): [
  authInfo: AuthInfo | undefined,
  setAuthInfo: (data: AuthInfo | undefined) => void,
] => {
  const [value] = useLocalStorage<AuthInfo | undefined>(
    authStorageKey,
    undefined,
  );

  const write = useCallback((data: AuthInfo | undefined) => {
    if (data === undefined) {
      deleteFromStorage(authStorageKey);
    } else {
      writeStorage(authStorageKey, data);
    }
  }, []);

  return [value, write];
};

export const useCleanAuthState = () => {
  const [authInfo, setAuthInfo] = useAuthState();

  useEffect(() => {
    const cb = async () => {
      if (!authInfo) return;

      try {
        await oryClient.toSession();
      } catch (e) {
        if (
          axios.isAxiosError(e) &&
          e.response?.status === 401 &&
          authInfo === undefined
        ) {
          setAuthInfo(undefined);
        } else {
          throw e;
        }
      }
    };

    cb();
  }, [authInfo, setAuthInfo]);
};
