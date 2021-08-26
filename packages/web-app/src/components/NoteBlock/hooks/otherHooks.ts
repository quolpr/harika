import { useEffect, MutableRefObject, useContext } from 'react';
import { CurrentBlockInputRefContext } from '../../../contexts';
import type { EditState, NoteBlockModel } from '@harika/web-core';
import { useNoteService } from '../../../contexts/CurrentNotesServiceContext';
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
  noteBlock: NoteBlockModel,
  editState: EditState,
) => {
  const noteRepo = useNoteService();

  const wasEditing = usePrevious(editState.isEditing);

  useEffect(() => {
    if (!editState.isEditing && wasEditing) {
      noteRepo.updateNoteBlockLinks([noteBlock.$modelId]);
    }
  }, [editState.isEditing, noteBlock, noteRepo, wasEditing]);
};
