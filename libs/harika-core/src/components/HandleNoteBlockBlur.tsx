import { useEffect } from 'react';
import { CurrentFocusedBlockContext } from '../contexts/CurrentEditContent';
import { usePrevious } from 'react-use';
import { useContext } from 'use-context-selector';

export const HandleNoteBlockBlur: React.FC = () => {
  const [editState] = useContext(CurrentFocusedBlockContext);

  const prevNoteBlock = usePrevious(editState?.noteBlock);

  useEffect(() => {
    (async () => {
      if (!prevNoteBlock) return;

      if (editState?.noteBlock !== prevNoteBlock) {
        prevNoteBlock.createNotesAndRefsIfNeeded();

        console.log('notes and refs are created!');
      }
    })();
  });

  return null;
};
