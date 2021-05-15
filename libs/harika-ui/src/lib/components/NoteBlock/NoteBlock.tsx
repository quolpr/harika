import React, { useCallback, useEffect, useRef, useState } from 'react';
import './styles.css';
import { useClickAway, usePrevious } from 'react-use';
import clsx from 'clsx';
import TextareaAutosize from 'react-textarea-autosize';
import { observer } from 'mobx-react-lite';
import { BlocksViewModel, NoteBlockModel } from '@harika/harika-front-core';
import { Arrow } from '../Arrow/Arrow';
import { computed } from 'mobx';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentFocusedBlockState } from '../../hooks/useFocusedBlockState';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { insertText, isIOS } from '../../utils';
import { Ref } from 'mobx-keystone';
import {
  useFakeInput,
  useHandleDoneIosButton,
  usePassCurrentInput,
} from './hooks';
import { TokensRenderer } from './TokensRenderer';
import { getTokensAtCursor } from './utils';

const NoteBlockChildren = observer(
  ({
    childBlocks,
    view,
  }: {
    childBlocks: Ref<NoteBlockModel>[];
    view: BlocksViewModel;
  }) => {
    return childBlocks.length !== 0 ? (
      <div className="note-block__child-blocks">
        {childBlocks.map((childNoteBlock) => (
          <NoteBlock
            key={childNoteBlock.current.$modelId}
            noteBlock={childNoteBlock.current}
            view={view}
          />
        ))}
      </div>
    ) : null;
  }
);

//TODO: fix textarea performance
export const NoteBlock = observer(
  ({
    noteBlock,
    view,
  }: {
    noteBlock: NoteBlockModel;
    view: BlocksViewModel;
  }) => {
    const vault = useCurrentVault();
    const noteRepo = useNoteRepository();
    const isExpanded = computed(() =>
      view.isExpanded(noteBlock.$modelId)
    ).get();

    const noteBlockRef = useRef<HTMLDivElement>(null);

    const [editState, setEditState] = useCurrentFocusedBlockState(
      view.$modelId,
      noteBlock.$modelId
    );

    const wasEditing = usePrevious(editState.isEditing);

    const { isFocused, startAt, isEditing } = editState;

    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    usePassCurrentInput(inputRef, isEditing);

    const { insertFakeInput, releaseFakeInput, fakeInputRef } = useFakeInput();

    const handleBlur = useHandleDoneIosButton(view, noteBlock);

    useClickAway(inputRef, (e) => {
      if (
        isEditing &&
        !(
          e.target instanceof Element &&
          e.target.closest('.toolbar') &&
          !e.target.closest('[data-defocus]')
        ) &&
        !(
          e.target instanceof Element &&
          e.target.closest('[data-type="note-block"]')
        )
      ) {
        setEditState({
          viewId: view.$modelId,
          blockId: noteBlock.$modelId,
          isEditing: false,
        });
      }
    });

    useEffect(() => {
      if (
        isEditing &&
        inputRef.current &&
        document.activeElement !== inputRef.current
      ) {
        if (!inputRef.current) return;

        const posAt = (() =>
          startAt !== undefined ? startAt : noteBlock.content.value.length)();

        inputRef.current.focus();

        inputRef.current.selectionStart = posAt;
        inputRef.current.selectionEnd = posAt;

        releaseFakeInput();
      }
    }, [
      isFocused,
      isEditing,
      startAt,
      noteBlock.content.value.length,
      fakeInputRef,
      releaseFakeInput,
    ]);

    const handleKeyPress = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // on ios sometime shiftKey === caps lock
        if (e.key === 'Enter' && (isIOS || !e.shiftKey)) {
          e.preventDefault();

          const content = noteBlock.content.value;

          const start = e.currentTarget.selectionStart;
          const end = e.currentTarget.selectionEnd;

          if (start === end) {
            const firstToken = getTokensAtCursor(
              start,
              noteBlock.content.ast
            )[0];

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

          if (noteBlockRef.current) {
            // New noteBlock is still not available in DOM,
            // so lets insert input near current block
            insertFakeInput(noteBlockRef.current);

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
      [noteBlock, view, insertFakeInput, releaseFakeInput, setEditState]
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
              if (noteBlockRef.current) {
                insertFakeInput();
              }

              setEditState({
                viewId: view.$modelId,
                blockId: mergedTo.$modelId,
                startAt:
                  mergedTo.content.value.length -
                  noteBlock.content.value.length,
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

          noteBlock.tryMoveLeft();
        } else if (e.key === 'ArrowDown' && e.shiftKey) {
          e.preventDefault();

          noteBlock.tryMoveRight();
        } else if (e.key === '[') {
          e.preventDefault();

          insertText(e.currentTarget, '[]', 1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();

          const [, right] = noteBlock.leftAndRight;

          if (right) {
            setEditState({
              viewId: view.$modelId,
              blockId: right.$modelId,
              isEditing: true,
            });
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();

          const [left] = noteBlock.leftAndRight;

          if (left) {
            setEditState({
              viewId: view.$modelId,
              blockId: left.$modelId,
              isEditing: true,
            });
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();

          e.currentTarget.blur();
        }
      },
      [insertFakeInput, noteBlock, setEditState, view.$modelId]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        noteBlock.content.update(e.target.value);

        const start = e.currentTarget.selectionStart;
        const end = e.currentTarget.selectionEnd;

        if (start === end) {
          const token = getTokensAtCursor(start, noteBlock.content.ast);

          if (token[0]?.type === 'ref') {
            console.log('Trigger autocomplete for', token[0].content);
          }
        }
      },
      [noteBlock]
    );

    const contentLength = noteBlock.content.value.length;

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        let startAt = contentLength;

        if (e.target instanceof HTMLElement) {
          // TODO: no FF support
          const range = document.caretRangeFromPoint(e.clientX, e.clientY);

          if (e.target.dataset.offsetStart) {
            startAt =
              parseInt(e.target.dataset.offsetStart, 10) + range.startOffset;
          }

          if (noteBlockRef.current) {
            insertFakeInput(noteBlockRef.current);
          }
        }

        setEditState({
          viewId: view.$modelId,
          blockId: noteBlock.$modelId,
          isEditing: true,
          startAt,
        });
      },
      [
        contentLength,
        insertFakeInput,
        noteBlock.$modelId,
        setEditState,
        view.$modelId,
      ]
    );

    useEffect(() => {
      if (!editState.isEditing && wasEditing) {
        noteRepo.updateNoteBlockLinks(vault, noteBlock);
      }
    }, [editState.isEditing, noteBlock, noteRepo, vault, wasEditing]);

    return (
      <div
        className="note-block"
        data-id={noteBlock.$modelId}
        data-order={noteBlock.orderPosition}
        data-type="note-block"
        ref={noteBlockRef}
      >
        <div className="note-block__body">
          {noteBlock.noteBlockRefs.length !== 0 && (
            <Arrow
              className="note-block__arrow"
              isExpanded={isExpanded}
              onToggle={() => {
                view.toggleExpand(noteBlock.$modelId);
              }}
            />
          )}

          <div
            className={clsx('note-block__dot', {
              'note-block__dot--expanded': isExpanded,
            })}
          />
          {/* <div */}
          {/*   className={clsx('note-block__outline', { */}
          {/*     'note-block__outline--show': isFocused, */}
          {/*   })} */}
          {/* > */}
          {isEditing && (
            <TextareaAutosize
              ref={inputRef}
              className={clsx('note-block__content', {
                'note-block__content--hidden': !isEditing,
              })}
              onKeyDown={handleKeyDown}
              onKeyPress={handleKeyPress}
              onChange={handleChange}
              value={noteBlock.content.value}
              onBlur={handleBlur}
            />
          )}
          {!isEditing && (
            <span
              onClick={handleClick}
              className={clsx('note-block__content', {
                'note-block__content--focused': isFocused,
              })}
            >
              <TokensRenderer
                noteBlock={noteBlock}
                tokens={noteBlock.content.ast}
              />
            </span>
          )}
          {/* </div> */}
        </div>
        {isExpanded && (
          <NoteBlockChildren
            childBlocks={noteBlock.noteBlockRefs}
            view={view}
          />
        )}
      </div>
    );
  }
);
