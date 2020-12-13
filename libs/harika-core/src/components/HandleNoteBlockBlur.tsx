import { HarikaNotesTableName } from '@harika/harika-notes';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect } from 'react';
import { CurrentFocusedBlockContext } from '../contexts/CurrentEditContent';
import { usePrevious } from 'react-use';
import { useContext } from 'use-context-selector';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';

export const HandleNoteBlockBlur: React.FC = () => {
  const database = useDatabase();
  const [editState] = useContext(CurrentFocusedBlockContext);

  const prevId = usePrevious(editState?.id);

  useEffect(() => {
    (async () => {
      if (!prevId) return;

      if (editState?.id !== prevId) {
        const noteBlock = await database.collections
          .get<NoteBlockModel>(HarikaNotesTableName.NOTE_BLOCKS)
          .find(prevId);

        await noteBlock.createNotesAndRefsIfNeeded();

        console.log('notes and refs are created!');
      }
    })();
  });

  return null;
};
