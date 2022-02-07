import { NoteBlock } from '@harika/web-core';
import { createContext, useContext } from 'react';

export const CurrentNoteContext = createContext<NoteBlock>(
  null as unknown as NoteBlock,
);

export const useCurrentNoteBlock = (): NoteBlock | undefined => {
  return useContext(CurrentNoteContext);
};
