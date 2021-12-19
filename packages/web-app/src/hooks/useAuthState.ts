import {
  writeStorage,
  useLocalStorage,
  deleteFromStorage,
} from '@rehooks/local-storage';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { useCallback, useEffect } from 'react';
import { firebaseApp } from '../firebaseApp';

export interface AuthInfo {
  userId: string;
  isOffline: boolean;
  authToken: string;
}

const storageKey = 'auth';

// TODO: maybe mobx localstorage?
export const useAuthState = (): [
  authInfo: AuthInfo | undefined,
  setAuthInfo: (data: AuthInfo | undefined) => void,
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

export const useRefreshAuthState = () => {
  useEffect(() => {
    const auth = getAuth(firebaseApp);

    const cb = async () => {
      const user = await new Promise<User | null>((resolve) =>
        onAuthStateChanged(auth, (u) => resolve(u)),
      );

      if (!user) return;
      const newToken = await user.getIdToken(true);

      const ls = localStorage.getItem(storageKey);
      if (!ls) return;
      const data: AuthInfo | undefined = JSON.parse(ls);
      if (!data) return;

      const newData: AuthInfo = { ...data, authToken: newToken };

      console.log({ newData });

      writeStorage(storageKey, newData);
    };

    cb();
  }, []);
};
