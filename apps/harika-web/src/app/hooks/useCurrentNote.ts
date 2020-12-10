import { HarikaNotesTableName } from '@harika/harika-notes';
import { useTableCustomSwitch } from './useTable';
import { Note as NoteModel } from '@harika/harika-notes';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useContext } from 'react';
import { CurrentNoteIdContext } from '../contexts/CurrentNoteIdContext';
import { of } from 'rxjs';

export const useCurrentNote = (): NoteModel | undefined => {
  const database = useDatabase();

  const [currentNoteId] = useContext(CurrentNoteIdContext);

  return useTableCustomSwitch(
    (val) =>
      val[0]
        ? database.collections
            .get<NoteModel>(HarikaNotesTableName.NOTES)
            .findAndObserve(val[0])
        : of(undefined),
    [currentNoteId]
  );
};
