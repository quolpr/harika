import { writeStorage, useLocalStorage } from '@rehooks/local-storage';
import { useCallback, useMemo } from 'react';

interface Account {
  id: string;
  stockId: string;
}

export interface OfflineAccounts {
  accounts: Account[];
}

const storageKey = 'offlineAccounts';

export const useOfflineAccounts = (): [
  accounts: OfflineAccounts,
  addOfflineAccount: (id: string, stockId: string) => void
] => {
  const emptyAccounts = useMemo(() => ({ accounts: [] }), []);

  const offlineAccounts =
    useLocalStorage<OfflineAccounts | undefined>(storageKey, undefined)[0] ||
    emptyAccounts;

  const addAccount = useCallback(
    (id: string, stockId: string) => {
      offlineAccounts.accounts.push({ id, stockId: stockId });

      writeStorage(storageKey, offlineAccounts);
    },
    [offlineAccounts]
  );

  return [offlineAccounts, addAccount];
};
