import {
  writeStorage,
  useLocalStorage,
  deleteFromStorage,
} from '@rehooks/local-storage';
import { useCallback } from 'react';

export interface AuthInfo {
  token: string;
  userId: string;
}

const authKey = 'auth';

// TODO: maybe mobx localstorage?
export const useAuthState = (): [
  authInfo: AuthInfo | undefined,
  setAuthInfo: (data: AuthInfo | undefined) => void
] => {
  const [value] = useLocalStorage<AuthInfo | undefined>(authKey, undefined);

  const write = useCallback((data: AuthInfo | undefined) => {
    if (data === undefined) {
      deleteFromStorage(authKey);
    } else {
      writeStorage(authKey, data);
    }
  }, []);

  return [value, write];
};
