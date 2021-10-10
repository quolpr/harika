import { VaultService } from '@harika/web-core';
import { createContext, useContext } from 'react';

export const NotesServiceContext = createContext<VaultService>(
  {} as VaultService,
);

export const useVaultService = () => {
  return useContext(NotesServiceContext);
};
