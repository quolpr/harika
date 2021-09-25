import React, { useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { BlocksScope, ScopedBlock } from '@harika/web-core';
import { TextareaAutosize } from '@material-ui/core';
import { NoteTitleAutocomplete } from './NoteTitleAutocomplete/NoteTitleAutocomplete';
import { useCurrentFocusedBlockState } from '../../../hooks/useFocusedBlockState';
import {
  useHandleFocus,
  useProvideInputToContext,
  useUpdateBlockLinks,
} from './hooks/otherHooks';
import { useHandleInput } from './hooks/useHandleInput';
import { observer } from 'mobx-react-lite';
import { EditorCommandsDropdown } from './EditorCommandsDropdown/EditorCommandsDropdown';
import { FindBlockDropdown } from './FindBlockDropdown/FindBlockDropdown';

export const BlockEditor = observer(
  ({
    scope,
    noteBlock,
    insertFakeInput,
    releaseFakeInput,
  }: {
    noteBlock: ScopedBlock;
    scope: BlocksScope;
    insertFakeInput: () => void;
    releaseFakeInput: () => void;
  }) => {
    const [editState] = useCurrentFocusedBlockState(
      scope.$modelId,
      noteBlock.$modelId,
    );

    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const inputId = `${scope.$modelId}-${noteBlock.$modelId}`;

    const { isEditing } = editState;

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
      noteBlock,
      inputRef,
      insertFakeInput,
      releaseFakeInput,
      isAnyDropdownShown,
    );
    useHandleFocus(editState, noteBlock, inputRef, releaseFakeInput);
    useUpdateBlockLinks(noteBlock, editState);
    useProvideInputToContext(inputRef, isEditing);

    console.log(blockToSearch);

    return (
      <div
        className={clsx('note-block__input-container', {
          'note-block__input-container--hidden': !isEditing,
        })}
        ref={wrapperRef}
      >
        <label htmlFor={inputId} className="hidden-label">
          NoteModel block content
        </label>

        <TextareaAutosize
          id={inputId}
          ref={inputRef}
          className={clsx('note-block__content', {})}
          value={noteBlock.content.value}
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
