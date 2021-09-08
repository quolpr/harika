import { useEffect, MutableRefObject, useContext } from 'react';
import { CurrentBlockInputRefContext } from '../../../contexts';
import type { BlocksViewModel, EditState } from '@harika/web-core';
import { useNotesService } from '../../../contexts/CurrentNotesServiceContext';
import { usePrevious } from 'react-use';

export const useProvideInputToContext = (
  inputRef: MutableRefObject<HTMLTextAreaElement | null>,
  isEditing: boolean,
) => {
  const currentBlockInputRef = useContext(CurrentBlockInputRefContext);

  useEffect(() => {
    if (isEditing) {
      currentBlockInputRef.current = inputRef.current;
    } else {
      if (currentBlockInputRef.current === inputRef.current) {
        currentBlockInputRef.current = null;
      }
    }
  }, [currentBlockInputRef, inputRef, isEditing]);
};

export const useUpdateBlockLinks = (
  blockView: BlocksViewModel,
  editState: EditState,
) => {
  const noteRepo = useNotesService();

  const wasEditing = usePrevious(editState.isEditing);

  useEffect(() => {
    if (!editState.isEditing && wasEditing) {
      noteRepo.updateNoteBlockLinks([blockView.noteBlockId]);
    }
  }, [editState.isEditing, blockView, noteRepo, wasEditing]);
};
