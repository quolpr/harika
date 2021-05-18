import type { BlocksViewModel, NoteBlockModel } from '@harika/web-core';
import { RefObject, useCallback, useState } from 'react';
import { useCurrentFocusedBlockState } from '../../../hooks/useFocusedBlockState';
import { isIOS, insertText } from '../../../utils';
import type { SearchedNote } from '../NoteTitleAutocomplete/NoteTitleAutocomplete';
import { getTokensAtCursor } from '../utils';

export const useHandleInput = (
  noteBlock: NoteBlockModel,
  view: BlocksViewModel,
  noteBlockElRef: RefObject<HTMLDivElement | null>,
  inputRef: RefObject<HTMLTextAreaElement | null>,
  insertFakeInput: (el?: HTMLElement) => void,
  releaseFakeInput: () => void,
) => {
  const [, setEditState] = useCurrentFocusedBlockState(
    view.$modelId,
    noteBlock.$modelId,
  );

  const [noteTitleToSearch, setNoteTitleToSearch] =
    useState<string | undefined>(undefined);

  const isSearching = Boolean(noteTitleToSearch);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      // on ios sometime shiftKey === caps lock
      if (e.key === 'Enter' && (isIOS || !e.shiftKey)) {
        e.preventDefault();

        const content = noteBlock.content.value;

        if (start === end) {
          const firstToken = getTokensAtCursor(start, noteBlock.content.ast)[0];

          if (firstToken?.type === 'ref' && start !== firstToken.offsetEnd) {
            e.currentTarget.selectionStart = firstToken.offsetEnd;
            e.currentTarget.selectionEnd = firstToken.offsetEnd;

            return;
          }
        }

        let newContent = '';

        if (start === end && start !== content.length) {
          newContent = content.slice(start, content.length);

          noteBlock.content.update(content.slice(0, start));
        }

        const newBlock = noteBlock.injectNewRightBlock(newContent, view);

        if (!newBlock) return;

        if (noteBlockElRef.current) {
          // New noteBlock is still not available in DOM,
          // so lets insert fake input near current block
          insertFakeInput(noteBlockElRef.current);

          setTimeout(releaseFakeInput, 0);
        }

        setEditState({
          viewId: view.$modelId,
          blockId: newBlock.$modelId,
          isEditing: true,
          startAt: 0,
        });
      }
    },
    [
      noteBlock,
      view,
      noteBlockElRef,
      setEditState,
      insertFakeInput,
      releaseFakeInput,
    ],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const content = noteBlock.content.value;
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (e.key === 'Backspace') {
        const isOnStart = start === end && start === 0;

        if (start === end) {
          const prevChar = content[start - 1];
          const nextChar = content[start];

          if (nextChar === ']' && prevChar === '[') {
            e.preventDefault();

            insertText(e.currentTarget, '', 0, {
              start: start - 1,
              end: start + 1,
            });

            return;
          }
        }

        if (isOnStart) {
          e.preventDefault();

          const mergedTo = noteBlock.mergeToLeftAndDelete();

          if (mergedTo) {
            if (noteBlockElRef.current) {
              insertFakeInput();
            }

            setEditState({
              viewId: view.$modelId,
              blockId: mergedTo.$modelId,
              startAt:
                mergedTo.content.value.length - noteBlock.content.value.length,
              isEditing: true,
            });
          }
        }
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();

        noteBlock.tryMoveUp();
      } else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();

        noteBlock.tryMoveDown();
      } else if (e.key === 'ArrowUp' && e.shiftKey) {
        e.preventDefault();

        if (!isSearching) noteBlock.tryMoveLeft();
      } else if (e.key === 'ArrowDown' && e.shiftKey) {
        e.preventDefault();

        if (!isSearching) noteBlock.tryMoveRight();
      } else if (e.key === '[') {
        e.preventDefault();

        insertText(e.currentTarget, '[]', 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();

        if (!isSearching) {
          const [, right] = noteBlock.leftAndRight;

          if (right) {
            setEditState({
              viewId: view.$modelId,
              blockId: right.$modelId,
              isEditing: true,
            });
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();

        if (!isSearching) {
          const [left] = noteBlock.leftAndRight;

          if (left) {
            setEditState({
              viewId: view.$modelId,
              blockId: left.$modelId,
              isEditing: true,
            });
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();

        e.currentTarget.blur();
      }
    },
    [
      insertFakeInput,
      isSearching,
      noteBlock,
      noteBlockElRef,
      setEditState,
      view.$modelId,
    ],
  );

  const handleCaretChange = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (start === end) {
        const firstToken = getTokensAtCursor(start, noteBlock.content.ast)[0];

        if (firstToken?.type !== 'ref') {
          setNoteTitleToSearch(undefined);
        }
      }
    },
    [noteBlock.content.ast],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      noteBlock.content.update(e.target.value);

      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (start === end) {
        const firstToken = getTokensAtCursor(start, noteBlock.content.ast)[0];

        if (firstToken?.type === 'ref') {
          setNoteTitleToSearch(firstToken.content);
        }
      } else {
        setNoteTitleToSearch(undefined);
      }
    },
    [noteBlock],
  );

  const handleSearchSelect = useCallback(
    (res: SearchedNote) => {
      if (!inputRef.current) return;
      const input = inputRef.current;

      const start = input.selectionStart;

      const firstToken = getTokensAtCursor(start, noteBlock.content.ast)[0];

      if (firstToken?.type === 'ref') {
        const toInsert = `[[${res.title}]]`;

        insertText(input, toInsert, toInsert.length, {
          start: firstToken.offsetStart,
          end: firstToken.offsetEnd,
        });
      }

      setNoteTitleToSearch(undefined);
    },
    [inputRef, noteBlock.content.ast],
  );

  return {
    textareaHandlers: {
      onKeyUp: handleCaretChange,
      onMouseDown: handleCaretChange,
      onMouseMove: handleCaretChange,
      onTouchStart: handleCaretChange,
      onInput: handleCaretChange,
      onPaste: handleCaretChange,
      onCut: handleCaretChange,
      onSelect: handleCaretChange,

      onKeyDown: handleKeyDown,
      onKeyPress: handleKeyPress,
      onChange: handleChange,
    },
    handleChange,
    noteTitleToSearch,
    handleSearchSelect,
  };
};