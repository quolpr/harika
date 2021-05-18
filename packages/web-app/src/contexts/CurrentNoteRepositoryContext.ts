import { createContext, useContext } from 'react';
import type { NotesRepository } from '@harika/web-core';

export const NoteRepositoryContext = createContext<NotesRepository>(
  {} as NotesRepository,
);

export const useNoteRepository = () => {
  return useContext(NoteRepositoryContext);
};
