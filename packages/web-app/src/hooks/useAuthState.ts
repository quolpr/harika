import {
  deleteFromStorage,
  useLocalStorage,
  writeStorage,
} from '@rehooks/local-storage';
import { useCallback, useEffect } from 'react';
import {
  doesSessionExist,
  getUserId,
} from 'supertokens-auth-react/recipe/session';

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
      if (!(await doesSessionExist())) return;
      const userId = await getUserId();

      if (authInfo.userId !== userId) {
        setAuthInfo(undefined);
      }
    };

    cb();
  }, [authInfo, setAuthInfo]);
};
