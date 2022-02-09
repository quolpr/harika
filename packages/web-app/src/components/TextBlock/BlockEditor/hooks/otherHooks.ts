import { CollapsableBlock, TextBlock } from '@harika/web-core';
import { MutableRefObject, useContext, useEffect } from 'react';
import { usePrevious } from 'react-use';

import { CurrentBlockInputRefContext } from '../../../../contexts';
import { EditState } from '../../../../hooks/useFocusedBlockState';
import { useUpdateLinkService } from '../../../../hooks/vaultAppHooks';

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
  block: CollapsableBlock<TextBlock>,
  editState: EditState,
) => {
  const updateLinkService = useUpdateLinkService();

  const wasEditing = usePrevious(editState.isEditing);

  useEffect(() => {
    if (!editState.isEditing && wasEditing) {
      block.originalBlock.contentModel.dumpValue();
      updateLinkService.updateBlockLinks([block.$modelId]);
    }
  }, [
    block.$modelId,
    block.originalBlock,
    editState.isEditing,
    updateLinkService,
    wasEditing,
  ]);
};

export const useHandleFocus = (
  editState: EditState,
  textBlock: CollapsableBlock<TextBlock>,
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
          : textBlock.originalBlock.contentModel.currentValue.length)();

      inputRef.current.focus();

      inputRef.current.selectionStart = posAt;
      inputRef.current.selectionEnd = posAt;

      releaseFakeInput();
    }
  }, [inputRef, isEditing, releaseFakeInput, startAt, textBlock.originalBlock]);
};
