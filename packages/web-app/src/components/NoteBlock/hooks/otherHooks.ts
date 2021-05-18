import { useEffect, MutableRefObject, useContext } from 'react';
import { CurrentBlockInputRefContext } from '../../../contexts';
import type { EditState, NoteBlockModel } from '@harika/web-core';
import { useNoteRepository } from '../../../contexts/CurrentNoteRepositoryContext';
import { usePrevious } from 'react-use';
import { useCurrentVault } from '../../../hooks/useCurrentVault';

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
  const vault = useCurrentVault();
  const noteRepo = useNoteRepository();

  const wasEditing = usePrevious(editState.isEditing);

  useEffect(() => {
    if (!editState.isEditing && wasEditing) {
      noteRepo.updateNoteBlockLinks(vault, noteBlock);
    }
  }, [editState.isEditing, noteBlock, noteRepo, vault, wasEditing]);

  // on demount
  useEffect(() => {
    return () => {
      if (wasEditing) {
        noteRepo.updateNoteBlockLinks(vault, noteBlock);
      }
    };
  }, [noteBlock, noteRepo, vault, wasEditing]);
};
