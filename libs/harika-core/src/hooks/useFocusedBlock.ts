import { of } from 'rxjs';
import { useContext } from 'use-context-selector';
import { CurrentFocusedBlockContext } from '../contexts/CurrentEditContent';
import { useTableCustomSwitch } from './useTable';
import {
  HarikaNotesTableName,
  NoteBlock as NoteBlockModel,
} from '@harika/harika-notes';
import { useDatabase } from '@nozbe/watermelondb/hooks';

export const useFocusedBlock = () => {
  const database = useDatabase();

  const [noteBlockState] = useContext(CurrentFocusedBlockContext);

  return useTableCustomSwitch(
    (val) =>
      val[0]
        ? database.collections
            .get<NoteBlockModel>(HarikaNotesTableName.NOTE_BLOCKS)
            .findAndObserve(val[0])
        : of(undefined),
    [noteBlockState?.id]
  );
};
