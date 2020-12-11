import { useContext } from 'react';
import { CurrentNoteIdContext } from '../contexts/CurrentNoteIdContext';
import { useRxDocument } from 'rxdb-hooks';
import { HarikaDatabaseDocuments } from '../HarikaDatabaseDocuments';
import { NoteDocument } from '../models/note';

export const useCurrentNote = (): NoteDocument | undefined => {
  const [currentNoteId] = useContext(CurrentNoteIdContext);

  const { result } = useRxDocument<NoteDocument>(
    HarikaDatabaseDocuments.NOTES,
    currentNoteId
  );

  return result;
};
