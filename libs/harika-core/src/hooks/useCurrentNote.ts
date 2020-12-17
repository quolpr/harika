import { NoteModel } from '@harika/harika-notes';
import { useContext } from 'react';
import { CurrentNoteContext } from '../contexts/CurrentNoteIdContext';

export const useCurrentNote = (): NoteModel | undefined => {
  const [note] = useContext(CurrentNoteContext);

  return note;
};
