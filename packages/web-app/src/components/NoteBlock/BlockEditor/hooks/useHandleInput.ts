import { BlocksScope, ScopedBlock, parseStringToTree } from '@harika/web-core';
import { RefObject, useCallback, useContext, useState } from 'react';
import { useNotesService } from '../../../../contexts/CurrentNotesServiceContext';
import { ShiftPressedContext } from '../../../../contexts/ShiftPressedContext';
import { useCurrentFocusedBlockState } from '../../../../hooks/useFocusedBlockState';
import { isIOS, insertText } from '../../../../utils';
import type { SearchedNote } from '../NoteTitleAutocomplete/NoteTitleAutocomplete';
import { getTokensAtCursor } from '../../utils';
import { Pos, position } from 'caret-pos';
import dayjs from 'dayjs';
import { ICommand } from '../EditorCommandsDropdown/EditorCommandsDropdown';

const symmetricCommands: { [P in ICommand['id']]?: string } = {
  pageRef: '[[]]',
  bold: '****',
  italics: '____',
  highlight: '^^^^',
  strikethrough: '~~~~',
  codeInline: '``',
  codeBlock: '```\n\n```',
};

export const useHandleInput = (
  scope: BlocksScope,
  block: ScopedBlock,
  inputRef: RefObject<HTMLTextAreaElement | null>,
  insertFakeInput: () => void,
  releaseFakeInput: () => void,
) => {
  const [caretPos, setCaretPos] = useState<Pos | undefined>();

  const [, setEditState] = useCurrentFocusedBlockState(
    scope.$modelId,
    block.$modelId,
  );

  const [noteTitleToSearch, setNoteTitleToSearch] = useState<
    string | undefined
  >(undefined);

  const [commandToSearch, setCommandToSearch] = useState<string | undefined>(
    undefined,
  );
  const [commandToSearchStartPos, setCommandToSearchStartPos] = useState<
    number | undefined
  >(undefined);

  // TODO: add commandToSearch support here
  // add isSearchDisplayedRef
  const isSearching = Boolean(noteTitleToSearch);

  const noteRepo = useNotesService();

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart;

      // if (e.key === '/' && commandToSearch === undefined) {
      //   setCommandToSearch('');
      // } else {
      //   setCommandToSearch((current) => {
      //     if (current === undefined) return current;

      //     if (/^[a-z0-9 ]$/i.test(e.key)) {
      //       return current + e.key;
      //     }
      //   });
      // }

      // on ios sometime shiftKey === caps lock
      if (e.key === 'Enter' && (isIOS || !e.shiftKey)) {
        if (isSearching) return;

        e.preventDefault();

        const { focusOn, focusStartAt } = block.handleEnterPress(start);

        // New blockView is still not available in DOM,
        // so lets insert fake input near current block
        insertFakeInput();
        setTimeout(releaseFakeInput, 0);

        if (focusOn) {
          setEditState({
            scopeId: scope.$modelId,
            scopedBlockId: focusOn.$modelId,
            isEditing: true,
            startAt: focusStartAt,
          });
        }
      }
    },
    [
      isSearching,
      block,
      insertFakeInput,
      releaseFakeInput,
      setEditState,
      scope.$modelId,
    ],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const content = block.content.value;
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (e.key === 'Escape') {
        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: block.$modelId,
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

          const mergedTo = block.mergeToLeftAndDelete();

          if (mergedTo) {
            insertFakeInput();

            setEditState({
              scopeId: scope.$modelId,
              scopedBlockId: mergedTo.$modelId,
              startAt:
                mergedTo.content.value.length - block.content.value.length,
              isEditing: true,
            });
          }
        }
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();

        if (!isSearching) {
          setEditState({
            scopeId: scope.$modelId,
            scopedBlockId: block.$modelId,
            startAt: start,
            isEditing: true,
          });
          block.moveUp();
        }
      } else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();

        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: block.$modelId,
          startAt: start,
          isEditing: true,
        });
        block.moveDown();
      } else if (e.key === 'ArrowUp' && e.shiftKey) {
        e.preventDefault();

        if (!isSearching) block.moveLeft();
      } else if (e.key === 'ArrowDown' && e.shiftKey) {
        e.preventDefault();

        if (!isSearching) block.moveRight();
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
              const [left] = block.leftAndRight;

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

            if (newStart === block.content.value.length) {
              const [, right] = block.leftAndRight;

              if (right) {
                setEditState({
                  scopeId: scope.$modelId,
                  scopedBlockId: right.$modelId,
                  isEditing: true,
                  startAt:
                    start === block.content.value.length
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
    [block, setEditState, scope.$modelId, insertFakeInput, isSearching],
  );

  const handleCaretChange = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (start === end) {
        const firstToken = getTokensAtCursor(start, block.content.ast)[0];

        if (firstToken?.type !== 'ref' && firstToken?.type !== 'tag') {
          setNoteTitleToSearch(undefined);
        }
      }
    },
    [block.content.ast],
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

      const injectedBlocks = scope.injectNewTreeTokens(block, parsedToTree);

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
      scope,
      block,
      noteRepo,
      setEditState,
    ],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      block.content.update(e.target.value);

      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (start === end) {
        const firstToken = getTokensAtCursor(start, block.content.ast)[0];

        if (firstToken?.type === 'ref' || firstToken?.type === 'tag') {
          setNoteTitleToSearch(firstToken.ref);
        }
      } else {
        setNoteTitleToSearch(undefined);
      }

      const splited = block.content.value.slice(0, end).split('/');

      if (splited.length >= 2) {
        setCommandToSearch(splited[splited.length - 1]);
        setCommandToSearchStartPos(
          splited.reduce((sum, chunk, i) => {
            return sum + (i === splited.length - 1 ? 0 : chunk.length);
          }, 0) +
            splited.length -
            1,
        );
      } else {
        setCommandToSearch(undefined);
        setCommandToSearchStartPos(undefined);
      }

      setCaretPos(position(e.target));
    },
    [block],
  );

  const handleSearchSelect = useCallback(
    (res: SearchedNote) => {
      if (!inputRef.current) return;
      const input = inputRef.current;

      const start = input.selectionStart;

      const firstToken = getTokensAtCursor(start, block.content.ast)[0];

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
    [inputRef, block.content.ast],
  );

  const handleCommandSelect = useCallback(
    (command: ICommand) => {
      if (
        !inputRef.current ||
        commandToSearch === undefined ||
        commandToSearchStartPos === undefined
      )
        return;
      const input = inputRef.current;

      const symmetricToInsert = symmetricCommands[command.id];

      if (symmetricToInsert) {
        insertText(input, symmetricToInsert, symmetricToInsert.length / 2, {
          start: commandToSearchStartPos - 1,
          end: commandToSearchStartPos + commandToSearch.length,
        });
      } else if (command.id === 'todo') {
        const toInsert = '[[TODO]] ';

        insertText(input, toInsert, toInsert.length, {
          start: commandToSearchStartPos - 1,
          end: commandToSearchStartPos + commandToSearch.length,
        });
      } else if (command.id === 'currentTime') {
        const toInsert = `${dayjs().format('HH:mm')} `;

        insertText(input, toInsert, toInsert.length, {
          start: commandToSearchStartPos - 1,
          end: commandToSearchStartPos + commandToSearch.length,
        });
      }
    },
    [commandToSearch, commandToSearchStartPos, inputRef],
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
    commandToSearch,
    handleSearchSelect,
    handleCommandSelect,
    caretPos,
  };
};