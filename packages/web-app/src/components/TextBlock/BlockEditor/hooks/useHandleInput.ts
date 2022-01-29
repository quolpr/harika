import {
  addTokensToNoteBlock,
  BlocksScope,
  CollapsableBlock,
  handleNewLinePress,
  parseStringToTree,
  TextBlock,
} from '@harika/web-core';
import { RefObject, useCallback, useContext, useState } from 'react';
import { ShiftPressedContext } from '../../../../contexts/ShiftPressedContext';
import { useCurrentFocusedBlockState } from '../../../../hooks/useFocusedBlockState';
import { isIOS, insertText } from '../../../../utils';
import type { SearchedNote } from '../NoteTitleAutocomplete/NoteTitleAutocomplete';
import { getTokensAtCursor } from '../../utils';
import { Pos, position } from 'caret-pos';
import dayjs from 'dayjs';
import { ICommand } from '../EditorCommandsDropdown/EditorCommandsDropdown';
import {
  useBlocksStore,
  useUpdateLinkService,
} from '../../../../hooks/vaultAppHooks';

const symmetricCommands: { [P in ICommand['id']]?: string } = {
  blockRef: '(())',
  noteRef: '[[]]',
  bold: '****',
  italics: '____',
  highlight: '^^^^',
  strikethrough: '~~~~',
  codeInline: '``',
  codeBlock: '```\n\n```',
};

export const useHandleInput = (
  scope: BlocksScope,
  block: CollapsableBlock<TextBlock>,
  inputRef: RefObject<HTMLTextAreaElement | null>,
  insertFakeInput: () => void,
  releaseFakeInput: () => void,
  isAnyDropdownShown: () => boolean,
) => {
  const blocksStore = useBlocksStore();
  const updateLinkService = useUpdateLinkService();

  const [caretPos, setCaretPos] = useState<Pos | undefined>();

  const [, setEditState] = useCurrentFocusedBlockState(
    scope.$modelId,
    block.$modelId,
  );

  const [noteTitleToSearch, setNoteTitleToSearch] = useState<
    string | undefined
  >(undefined);

  const [blockToSearch, setBlockToSearch] = useState<string | undefined>(
    undefined,
  );

  const [commandToSearch, setCommandToSearch] = useState<string | undefined>(
    undefined,
  );
  const [commandToSearchStartPos, setCommandToSearchStartPos] = useState<
    number | undefined
  >(undefined);

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
        if (isAnyDropdownShown()) return;

        e.preventDefault();

        const { focusOn, focusStartAt } = handleNewLinePress(
          blocksStore,
          block,
          start,
        );

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
      isAnyDropdownShown,
      blocksStore,
      block,
      insertFakeInput,
      releaseFakeInput,
      setEditState,
      scope.$modelId,
    ],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const content = block.originalBlock.contentModel.currentValue;
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

          if (
            (nextChar === ']' && prevChar === '[') ||
            (nextChar === ')' && prevChar === '(')
          ) {
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

          if (mergedTo && mergedTo.originalBlock instanceof TextBlock) {
            insertFakeInput();

            setEditState({
              scopeId: scope.$modelId,
              scopedBlockId: mergedTo.$modelId,
              startAt:
                mergedTo.originalBlock.contentModel.currentValue.length -
                block.originalBlock.contentModel.currentValue.length,
              isEditing: true,
            });
          }
        }
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();

        if (!isAnyDropdownShown()) {
          setEditState({
            scopeId: scope.$modelId,
            scopedBlockId: block.$modelId,
            startAt: start,
            isEditing: true,
          });
          block.tryMoveUp();
        }
      } else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();

        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: block.$modelId,
          startAt: start,
          isEditing: true,
        });
        block.tryMoveDown();
      } else if (e.key === 'ArrowUp' && e.shiftKey) {
        e.preventDefault();

        if (!isAnyDropdownShown()) block.tryMoveLeft();
      } else if (e.key === 'ArrowDown' && e.shiftKey) {
        e.preventDefault();

        if (!isAnyDropdownShown()) block.tryMoveRight();
      } else if (e.key === '[') {
        e.preventDefault();

        insertText(e.currentTarget, '[]', 1);
      } else if (e.key === '(') {
        e.preventDefault();

        insertText(e.currentTarget, '()', 1);
      } else if (e.key === 'ArrowUp') {
        const target = e.currentTarget;

        if (!isAnyDropdownShown()) {
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

        if (!isAnyDropdownShown()) {
          requestAnimationFrame(() => {
            const newStart = target.selectionStart;

            if (
              newStart === block.originalBlock.contentModel.currentValue.length
            ) {
              const [, right] = block.leftAndRight;

              if (right && right.originalBlock instanceof TextBlock) {
                setEditState({
                  scopeId: scope.$modelId,
                  scopedBlockId: right.$modelId,
                  isEditing: true,
                  startAt:
                    start ===
                    block.originalBlock.contentModel.currentValue.length
                      ? right.originalBlock.contentModel.currentValue.length
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
    [block, setEditState, scope.$modelId, insertFakeInput, isAnyDropdownShown],
  );

  const handleCaretChange = useCallback(
    (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (start === end) {
        const firstToken = getTokensAtCursor(
          start,
          block.originalBlock.contentModel.ast,
        )[0];

        if (firstToken?.type !== 'noteRef' && firstToken?.type !== 'tag') {
          setNoteTitleToSearch(undefined);
        }

        if (firstToken?.type !== 'textBlockRef') {
          setBlockToSearch(undefined);
        }
      }
    },
    [block.originalBlock.contentModel.ast],
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

      const injectedBlocks = addTokensToNoteBlock(
        blocksStore,
        scope,
        block,
        parsedToTree,
      );

      const ids = injectedBlocks.map(({ $modelId }) => $modelId);
      updateLinkService.updateBlockLinks(ids);

      if (injectedBlocks[0]) {
        setEditState({
          scopeId: scope.$modelId,
          scopedBlockId: injectedBlocks[0].$modelId,
          isEditing: true,
        });
      }
    },
    [
      block,
      blocksStore,
      handleCaretChange,
      isShiftPressedRef,
      scope,
      setEditState,
      updateLinkService,
    ],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      block.originalBlock.contentModel.update(e.target.value);

      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;

      if (start === end) {
        const firstToken = getTokensAtCursor(
          start,
          block.originalBlock.contentModel.ast,
        )[0];

        if (firstToken?.type === 'noteRef' || firstToken?.type === 'tag') {
          setNoteTitleToSearch(firstToken.ref);
        } else if (firstToken?.type === 'textBlockRef') {
          if (!firstToken.blockId) {
            setBlockToSearch(firstToken.content);
          } else {
            setBlockToSearch(undefined);
          }
        }
      } else {
        setNoteTitleToSearch(undefined);
        setBlockToSearch(undefined);
      }

      const splited = block.originalBlock.contentModel.currentValue
        .slice(0, end)
        .split('/');

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
  const handleBlockSelect = useCallback(
    (res: { id: string }) => {
      if (!inputRef.current) return;
      const input = inputRef.current;
      const start = input.selectionStart;
      const firstToken = getTokensAtCursor(
        start,
        block.originalBlock.contentModel.ast,
      )[0];

      if (firstToken?.type === 'textBlockRef') {
        const toInsert = `((~${res.id})) `;

        insertText(input, toInsert, toInsert.length, {
          start: firstToken.offsetStart,
          end: firstToken.offsetEnd,
        });
      } else {
        console.error("Can't complete block ref - token not found");
      }

      setBlockToSearch(undefined);
    },
    [block.originalBlock.contentModel.ast, inputRef],
  );

  const handleSearchSelect = useCallback(
    (res: SearchedNote) => {
      if (!inputRef.current) return;
      const input = inputRef.current;

      const start = input.selectionStart;

      const firstToken = getTokensAtCursor(
        start,
        block.originalBlock.contentModel.ast,
      )[0];

      if (firstToken?.type === 'noteRef') {
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
      } else {
        console.error("Can't complete note ref - token found");
      }

      setNoteTitleToSearch(undefined);
    },
    [inputRef],
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
    blockToSearch,
    commandToSearch,
    handleSearchSelect,
    handleCommandSelect,
    handleBlockSelect,
    caretPos,
  };
};
