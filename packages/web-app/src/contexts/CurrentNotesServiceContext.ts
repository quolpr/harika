import { createContext, useContext } from 'react';
import type { NotesService } from '@harika/web-core';

export const NotesServiceContext = createContext<NotesService>(
  {} as NotesService,
);

export const useNotesService = () => {
  return useContext(NotesServiceContext);
};
