import {
  writeStorage,
  useLocalStorage,
  deleteFromStorage,
} from '@rehooks/local-storage';
import { useCallback } from 'react';

export interface AuthInfo {
  token: string;
  userId: string;
  stockId: string;
  isOffline: boolean;
}

const storageKey = 'auth';

// TODO: maybe mobx localstorage?
export const useAuthState = (): [
  authInfo: AuthInfo | undefined,
  setAuthInfo: (data: AuthInfo | undefined) => void
] => {
  const [value] = useLocalStorage<AuthInfo | undefined>(storageKey, undefined);

  const write = useCallback((data: AuthInfo | undefined) => {
    if (data === undefined) {
      deleteFromStorage(storageKey);
    } else {
      writeStorage(storageKey, data);
    }
  }, []);

  return [value, write];
};
