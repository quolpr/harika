import React, {useRef} from 'react';
import clsx from 'clsx';
import {BlocksScope, ScopedBlock} from '@harika/web-core';
import {TextareaAutosize} from '@material-ui/core';
import {NoteTitleAutocomplete} from './NoteTitleAutocomplete/NoteTitleAutocomplete';
import {useCurrentFocusedBlockState} from '../../../hooks/useFocusedBlockState';
import {useHandleFocus, useProvideInputToContext, useUpdateBlockLinks,} from './hooks/otherHooks';
import {useHandleInput} from './hooks/useHandleInput';
import {observer} from 'mobx-react-lite';

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
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const inputId = `${scope.$modelId}-${noteBlock.$modelId}`;

    const { isEditing } = editState;

    useHandleFocus(editState, noteBlock, inputRef, releaseFakeInput);

    const { textareaHandlers, noteTitleToSearch, handleSearchSelect } =
      useHandleInput(
        scope,
        noteBlock,
        inputRef,
        insertFakeInput,
        releaseFakeInput,
      );

    useUpdateBlockLinks(noteBlock, editState);
    useProvideInputToContext(inputRef, isEditing);

    return (
      <div
        className={clsx('note-block__input-container', {
          'note-block__input-container--hidden': !isEditing,
        })}
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
        {noteTitleToSearch && (
          <NoteTitleAutocomplete
            value={noteTitleToSearch}
            onSelect={handleSearchSelect}
          />
        )}
      </div>
    );
  },
);
