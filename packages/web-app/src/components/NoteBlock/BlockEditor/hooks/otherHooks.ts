import { MutableRefObject, useContext, useEffect } from 'react';
import { CurrentBlockInputRefContext } from '../../../../contexts';
import type { EditState, ScopedBlock } from '@harika/web-core';
import { useVaultService } from '../../../../contexts/CurrentNotesServiceContext';
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

export const useUpdateBlockValues = (
  blockView: ScopedBlock,
  editState: EditState,
) => {
  const noteRepo = useVaultService();

  const wasEditing = usePrevious(editState.isEditing);

  useEffect(() => {
    if (!editState.isEditing && wasEditing) {
      blockView.content.dumpValue();
      noteRepo.updateNoteBlockLinks([blockView.$modelId]);
      noteRepo.updateBlockBlockLinks([blockView.$modelId]);
    }
  }, [editState.isEditing, blockView, noteRepo, wasEditing]);
};

export const useHandleFocus = (
  editState: EditState,
  noteBlock: ScopedBlock,
  inputRef: MutableRefObject<HTMLTextAreaElement | null>,
  releaseFakeInput: () => void,
) => {
  const { isEditing, startAt } = editState;

  useEffect(() => {
    if (
      isEditing &&
      inputRef.current &&
      document.activeElement !== inputRef.current
    ) {
      if (!inputRef.current) return;

      const posAt = (() =>
        startAt !== undefined
          ? startAt
          : noteBlock.content.currentValue.length)();

      inputRef.current.focus();

      inputRef.current.selectionStart = posAt;
      inputRef.current.selectionEnd = posAt;

      releaseFakeInput();
    }
  }, [
    isEditing,
    startAt,
    releaseFakeInput,
    inputRef,
    noteBlock.content.currentValue.length,
  ]);
};
