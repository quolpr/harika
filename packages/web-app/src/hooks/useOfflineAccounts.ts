import { useLocalStorage,writeStorage } from '@rehooks/local-storage';
import { useCallback, useMemo } from 'react';

interface Account {
  id: string;
  dbId: string;
}

export interface OfflineAccounts {
  accounts: Account[];
}

const storageKey = 'offlineAccounts';

export const useOfflineAccounts = (): [
  accounts: OfflineAccounts,
  addOfflineAccount: (id: string, dbId: string) => void,
] => {
  const emptyAccounts = useMemo(() => ({ accounts: [] }), []);

  const offlineAccounts =
    useLocalStorage<OfflineAccounts | undefined>(storageKey, undefined)[0] ||
    emptyAccounts;

  const addAccount = useCallback(
    (id: string, dbId: string) => {
      offlineAccounts.accounts.push({ id, dbId });

      writeStorage(storageKey, offlineAccounts);
    },
    [offlineAccounts],
  );

  return [offlineAccounts, addAccount];
};
