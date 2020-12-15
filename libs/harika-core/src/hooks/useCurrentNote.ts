import { NoteMemModel } from '@harika/harika-notes';
import { useContext } from 'react';
import { CurrentNoteContext } from '../contexts/CurrentNoteIdContext';

export const useCurrentNote = (): NoteMemModel | undefined => {
  const [note] = useContext(CurrentNoteContext);

  return note;
};
