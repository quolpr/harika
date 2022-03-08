import { BlocksScope, CollapsableBlock, TextBlock } from '@harika/web-core';
import { TextareaAutosize } from '@material-ui/core';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useRef } from 'react';

import {
  useCurrentFocus,
  useCurrentIsEditing,
} from '../../../hooks/useBlockFocusState';
import { EditorCommandsDropdown } from './EditorCommandsDropdown/EditorCommandsDropdown';
import { FindBlockDropdown } from './FindBlockDropdown/FindBlockDropdown';
import {
  useHandleFocus,
  useProvideInputToContext,
  useUpdateBlockValues,
} from './hooks/otherHooks';
import { useHandleInput } from './hooks/useHandleInput';
import { NoteTitleAutocomplete } from './NoteTitleAutocomplete/NoteTitleAutocomplete';

export const BlockEditor = observer(
  ({
    scope,
    textBlock,
    insertFakeInput,
    releaseFakeInput,
  }: {
    textBlock: CollapsableBlock<TextBlock>;
    scope: BlocksScope;
    insertFakeInput: () => void;
    releaseFakeInput: () => void;
  }) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const inputId = `${scope.$modelId}-${textBlock.$modelId}`;

    const isTitleDropdownShownRef = useRef(false);
    const isCommandsDropdownShownRef = useRef(false);
    const isBlockDropdownShownRef = useRef(false);
    const isAnyDropdownShown = useCallback(() => {
      return (
        isTitleDropdownShownRef.current ||
        isCommandsDropdownShownRef.current ||
        isBlockDropdownShownRef.current
      );
    }, []);

    const blockFocus = useCurrentFocus(scope.$modelId, textBlock.$modelId);
    const isEditing = useCurrentIsEditing(scope.$modelId, textBlock.$modelId);

    const {
      textareaHandlers,
      noteTitleToSearch,
      blockToSearch,
      commandToSearch,
      handleSearchSelect,
      handleCommandSelect,
      handleBlockSelect,
      caretPos,
    } = useHandleInput(
      scope,
      textBlock,
      inputRef,
      insertFakeInput,
      releaseFakeInput,
      isAnyDropdownShown,
    );
    useHandleFocus(
      blockFocus,
      isEditing,
      textBlock,
      inputRef,
      releaseFakeInput,
    );
    useUpdateBlockValues(textBlock, isEditing);
    useProvideInputToContext(inputRef, isEditing);

    return (
      <div
        className={clsx('text-block__input-container', {
          'text-block__input-container--hidden': !isEditing,
        })}
        ref={wrapperRef}
      >
        <label htmlFor={inputId} className="hidden-label">
          NoteModel block content
        </label>

        <TextareaAutosize
          id={inputId}
          ref={inputRef}
          className={clsx('text-block__content', {})}
          value={textBlock.originalBlock.contentModel.currentValue}
          {...textareaHandlers}
        />
        {noteTitleToSearch !== undefined && (
          <NoteTitleAutocomplete
            isShownRef={isTitleDropdownShownRef}
            value={noteTitleToSearch}
            onSelect={handleSearchSelect}
            caretPos={caretPos}
            holderRef={wrapperRef}
          />
        )}
        {commandToSearch !== undefined && (
          <EditorCommandsDropdown
            isShownRef={isCommandsDropdownShownRef}
            value={commandToSearch}
            onSelect={handleCommandSelect}
            caretPos={caretPos}
            holderRef={wrapperRef}
          />
        )}
        {blockToSearch !== undefined && (
          <FindBlockDropdown
            isShownRef={isBlockDropdownShownRef}
            value={blockToSearch}
            onSelect={handleBlockSelect}
            caretPos={caretPos}
            holderRef={wrapperRef}
          />
        )}
      </div>
    );
  },
);
