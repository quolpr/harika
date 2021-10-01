import { createContext, useContext } from 'react';
import type { VaultApp } from '@harika/web-core';

export const NotesServiceContext = createContext<VaultApp>(
  {} as VaultApp,
);

export const useNotesService = () => {
  return useContext(NotesServiceContext);
};
