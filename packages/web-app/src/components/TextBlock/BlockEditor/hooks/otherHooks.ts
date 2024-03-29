import { BlockView, TextBlock } from '@harika/web-core';
import { MutableRefObject, useContext, useEffect } from 'react';
import { usePrevious } from 'react-use';

import { CurrentBlockInputRefContext } from '../../../../contexts';
import { BlockFocus } from '../../../../hooks/useBlockFocusState';

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
  block: BlockView<TextBlock>,
  isEditing: boolean,
) => {
  const wasEditing = usePrevious(isEditing);

  useEffect(() => {
    if (!isEditing && wasEditing) {
      block.originalBlock.contentModel.dumpValue();
    }
  }, [block.$modelId, block.originalBlock, isEditing, wasEditing]);
};

export const useHandleFocus = (
  blockFocus: BlockFocus | undefined,
  isEditing: boolean,
  textBlock: BlockView<TextBlock>,
  inputRef: MutableRefObject<HTMLTextAreaElement | null>,
  releaseFakeInput: () => void,
) => {
  const startAt = blockFocus?.startAt;

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
