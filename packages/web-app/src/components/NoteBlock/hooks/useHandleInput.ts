import { BlocksScope, ScopedBlock, parseStringToTree } from '@harika/web-core';
import { RefObject, useCallback, useContext, useState } from 'react';
import { useNotesService } from '../../../contexts/CurrentNotesServiceContext';
import { ShiftPressedContext } from '../../../contexts/ShiftPressedContext';
import { useCurrentFocusedBlockState } from '../../../hooks/useFocusedBlockState';
import { isIOS, insertText } from '../../../utils';
import type { SearchedNote } from '../NoteTitleAutocomplete/NoteTitleAutocomplete';
import { getTokensAtCursor } from '../utils';

export const useHandleInput = (
  scope: BlocksScope,
  blockView: ScopedBlock,
  noteBlockElRef: RefObject<HTMLDivElement | null>,
  inputRef: RefObject<HTMLTextAreaElement | null>,
  insertFakeInput: (el?: HTMLElement) => void,
  releaseFakeInput: () => void,
) => {
  const [, setEditState] = useCurrentFocusedBlockState(
    scope.$modelId,
    blockView.$modelId,
  );

  const [noteTitleToSearch, setNoteTitleToSearch] = useState<
    string | undefined
  >(undefined);

  const isSearching = Boolean(noteTitleToSearch);

  const noteRepo = useNotesService();

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      // on ios sometime shiftKey === caps lock
      if (e.key === 'Enter' && (isIOS || !e.shiftKey)) {
        if (isSearching) return;

        e.preventDefault();

        const content = blockView.content.value;

        let newContent = '';
        let startAt = 0;

        if (start === end && start !== content.length) {
          newContent = content.slice(start, content.length);

          blockView.content.update(content.slice(0, start));
        }
        if (
          (blockView.content.hasTodo ||
            (blockView.children.length > 0 &&
              blockView.children[0].content.hasTodo)) &&
          newContent.length === 0
        ) {
          newContent = '[[TODO]] ';
          startAt = newContent.length;
        }

        const newBlock = blockView.injectNewRightBlock(newContent, blockView);

        if (!newBlock) return;

        if (noteBlockElRef.current) {
          // New blockView is still not available in DOM,
          // so lets insert fake input near current block
          insertFakeInput(noteBlockElRef.current);

          setTimeout(releaseFakeInput, 0);
        }

        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: newBlock.$modelId,
          isEditing: true,
          startAt,
        });
      }
    },
    [
      isSearching,
      blockView,
      noteBlockElRef,
      setEditState,
      scope.$modelId,
      insertFakeInput,
      releaseFakeInput,
    ],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const content = blockView.content.value;
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (e.key === 'Escape') {
        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: blockView.$modelId,
          isEditing: false,
        });
      } else if (e.key === 'Backspace') {
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

          const mergedTo = blockView.mergeToLeftAndDelete();

          if (mergedTo) {
            if (noteBlockElRef.current) {
              insertFakeInput();
            }

            setEditState({
              scopeId: scope.$modelId,
              scopedBlockId: mergedTo.$modelId,
              startAt:
                mergedTo.content.value.length - blockView.content.value.length,
              isEditing: true,
            });
          }
        }
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();

        if (!isSearching) {
          setEditState({
            scopeId: scope.$modelId,
            scopedBlockId: blockView.$modelId,
            startAt: start,
            isEditing: true,
          });
          blockView.moveUp();
        }
      } else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();

        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: blockView.$modelId,
          startAt: start,
          isEditing: true,
        });
        blockView.moveDown();
      } else if (e.key === 'ArrowUp' && e.shiftKey) {
        e.preventDefault();

        if (!isSearching) blockView.moveLeft();
      } else if (e.key === 'ArrowDown' && e.shiftKey) {
        e.preventDefault();

        if (!isSearching) blockView.moveRight();
      } else if (e.key === '[') {
        e.preventDefault();

        insertText(e.currentTarget, '[]', 1);
      } else if (e.key === 'ArrowUp') {
        const target = e.currentTarget;

        if (!isSearching) {
          requestAnimationFrame(() => {
            const newStart = target.selectionStart;

            // When cursor moved to the start of the string - it means there is now any rows upper
            if (newStart === 0) {
              const [left] = blockView.leftAndRight;

              if (left) {
                setEditState({
                  scopeId: scope.$modelId,
                  scopedBlockId: left.$modelId,
                  isEditing: true,
                  startAt: start,
                });
              }
            }
          });
        }
      } else if (e.key === 'ArrowDown') {
        const target = e.currentTarget;

        if (!isSearching) {
          requestAnimationFrame(() => {
            const newStart = target.selectionStart;

            if (newStart === blockView.content.value.length) {
              const [, right] = blockView.leftAndRight;

              if (right) {
                setEditState({
                  scopeId: scope.$modelId,
                  scopedBlockId: right.$modelId,
                  isEditing: true,
                  startAt:
                    start === blockView.content.value.length
                      ? right.content.value.length
                      : start,
                });
              }
            }
          });
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();

        e.currentTarget.blur();
      }
    },
    [
      blockView,
      setEditState,
      scope.$modelId,
      noteBlockElRef,
      insertFakeInput,
      isSearching,
    ],
  );

  const handleCaretChange = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (start === end) {
        const firstToken = getTokensAtCursor(start, blockView.content.ast)[0];

        if (firstToken?.type !== 'ref' && firstToken?.type !== 'tag') {
          setNoteTitleToSearch(undefined);
        }
      }
    },
    [blockView.content.ast],
  );

  // const [isShiftPressed] = useKeyPress((e) => e.shiftKey);

  const isShiftPressedRef = useContext(ShiftPressedContext);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      handleCaretChange(e);

      if (isShiftPressedRef.current) return;

      const data = e.clipboardData.getData('Text');

      if (data.length === 0) return;

      const parsedToTree = parseStringToTree(data);

      if (parsedToTree.length === 0) return;

      e.preventDefault();

      const injectedBlocks = blockView.injectNewTreeTokens(parsedToTree);

      noteRepo.updateNoteBlockLinks(
        injectedBlocks.map(({ $modelId }) => $modelId),
      );

      if (injectedBlocks[0]) {
        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: injectedBlocks[0].$modelId,
          isEditing: true,
        });
      }
    },
    [
      handleCaretChange,
      isShiftPressedRef,
      blockView,
      noteRepo,
      setEditState,
      scope.$modelId,
    ],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      blockView.content.update(e.target.value);

      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (start === end) {
        const firstToken = getTokensAtCursor(start, blockView.content.ast)[0];

        if (firstToken?.type === 'ref' || firstToken?.type === 'tag') {
          setNoteTitleToSearch(firstToken.ref);
        }
      } else {
        setNoteTitleToSearch(undefined);
      }
    },
    [blockView],
  );

  const handleSearchSelect = useCallback(
    (res: SearchedNote) => {
      if (!inputRef.current) return;
      const input = inputRef.current;

      const start = input.selectionStart;

      const firstToken = getTokensAtCursor(start, blockView.content.ast)[0];

      if (firstToken?.type === 'ref') {
        const alias = firstToken.alias ? ` | ${firstToken.alias}` : '';
        const toInsert = `[[${res.title}${alias}]] `;

        insertText(input, toInsert, toInsert.length, {
          start: firstToken.offsetStart,
          end: firstToken.offsetEnd,
        });
      } else if (firstToken?.type === 'tag') {
        const hasSpaces = /\s/g.test(res.title);

        const toInsert = `#${hasSpaces ? `[[${res.title}]]` : res.title} `;

        insertText(input, toInsert, toInsert.length, {
          start: firstToken.offsetStart,
          end: firstToken.offsetEnd,
        });
      }

      setNoteTitleToSearch(undefined);
    },
    [inputRef, blockView.content.ast],
  );

  return {
    textareaHandlers: {
      onKeyUp: handleCaretChange,
      onMouseDown: handleCaretChange,
      onMouseMove: handleCaretChange,
      onTouchStart: handleCaretChange,
      onInput: handleCaretChange,
      onPaste: handlePaste,
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
