import type { NoteModel } from '@harika/web-core';
import { createContext, useContext } from 'react';

export const CurrentNoteContext = createContext<NoteModel>(
  null as unknown as NoteModel,
);

export const useCurrentNote = (): NoteModel | undefined => {
  return useContext(CurrentNoteContext);
};
