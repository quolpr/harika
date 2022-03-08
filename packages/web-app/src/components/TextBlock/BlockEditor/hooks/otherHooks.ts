import { CollapsableBlock, TextBlock } from '@harika/web-core';
import { MutableRefObject, useContext, useEffect } from 'react';
import { usePrevious } from 'react-use';

import { CurrentBlockInputRefContext } from '../../../../contexts';
import { BlockFocus } from '../../../../hooks/useBlockFocusState';
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
  isEditing: boolean,
) => {
  const updateLinkService = useUpdateLinkService();

  const wasEditing = usePrevious(isEditing);

  useEffect(() => {
    if (!isEditing && wasEditing) {
      block.originalBlock.contentModel.dumpValue();
      updateLinkService.updateBlockLinks([block.$modelId]);
    }
  }, [
    block.$modelId,
    block.originalBlock,
    isEditing,
    updateLinkService,
    wasEditing,
  ]);
};

export const useHandleFocus = (
  blockFocus: BlockFocus | undefined,
  isEditing: boolean,
  textBlock: CollapsableBlock<TextBlock>,
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
