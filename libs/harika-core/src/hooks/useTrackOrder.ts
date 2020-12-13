import { useEffect } from 'react';
import usePrevious from 'react-use/lib/usePrevious';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';

export const useTrackOrder = (
  noteBlock: NoteBlockModel,
  onOrderChange: () => void
) => {
  const prevOrder = usePrevious(noteBlock.order);

  useEffect(() => {
    if (prevOrder === undefined) return;
    if (prevOrder === noteBlock.order) return;

    onOrderChange();
  }, [onOrderChange, noteBlock.order, prevOrder]);
};
