import { NoteModel } from '@harika/harika-core';
import { useContext } from 'react';
import { CurrentNoteContext } from '../contexts/CurrentNoteContext';

export const useCurrentNote = (): NoteModel | undefined => {
  const [note] = useContext(CurrentNoteContext);

  return note;
};
