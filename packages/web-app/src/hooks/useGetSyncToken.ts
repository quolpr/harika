import { getAuth, onAuthStateChanged,User } from 'firebase/auth';
import { useCallback } from 'react';

import { firebaseApp } from '../firebaseApp';

export const useGetSyncToken = () => {
  return useCallback(async () => {
    const auth = getAuth(firebaseApp);

    const user = await new Promise<User | null>((resolve) =>
      onAuthStateChanged(auth, (u) => resolve(u)),
    );

    if (!user) return;

    return await user.getIdToken();
  }, []);
};
