import { createContext, useContext } from 'react';
import type { NotesService } from '@harika/web-core';

export const NotesServiceContext = createContext<NotesService>(
  {} as NotesService,
);

export const useNoteService = () => {
  return useContext(NotesServiceContext);
};
