import { createContext, useContext } from 'react';
import { NotesRepository } from '@harika/harika-front-core';

export const NoteRepositoryContext = createContext<NotesRepository>(
  {} as NotesRepository
);

export const useNoteRepository = () => {
  return useContext(NoteRepositoryContext);
};
