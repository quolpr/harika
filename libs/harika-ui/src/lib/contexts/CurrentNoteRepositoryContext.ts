import { createContext, useContext } from 'react';
import { NoteRepository } from '@harika/harika-core';

export const NoteRepositoryContext = createContext<NoteRepository>(
  {} as NoteRepository
);

export const useNoteRepository = () => {
  return useContext(NoteRepositoryContext);
};
