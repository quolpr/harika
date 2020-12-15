import React, { useCallback, useEffect, useRef, useState } from 'react';
import './styles.css';
import { useClickAway } from 'react-use';
import { useContextSelector } from 'use-context-selector';
import clsx from 'clsx';
import TextareaAutosize from 'react-textarea-autosize';
import { CurrentFocusedBlockContext } from '@harika/harika-core';
import { observer } from 'mobx-react-lite';
import { NoteBlockModel } from '@harika/harika-notes';

export const NoteBlock = observer(
  ({ noteBlock }: { noteBlock: NoteBlockModel }) => {
    const [noteBlockContent, setNoteBlockContent] = useState({
      content: noteBlock.content,
      id: noteBlock.$modelId,
    });

    useEffect(() => {
      setNoteBlockContent({
        content: noteBlock.content,
        id: noteBlock.$modelId,
      });
    }, [noteBlock.$modelId, noteBlock.content]);

    const setEditState = useContextSelector(
      CurrentFocusedBlockContext,
      ([, setEditState]) => setEditState
    );
    const isEditing = useContextSelector(
      CurrentFocusedBlockContext,
      ([editState]) => editState?.noteBlock === noteBlock
    );
    const startPositionAt = useContextSelector(
      CurrentFocusedBlockContext,
      ([editState]) =>
        editState?.noteBlock === noteBlock
          ? editState.startPositionAt
          : undefined
    );

    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    useClickAway(inputRef, () => {
      if (isEditing) {
        setEditState(undefined);
      }
    });

    useEffect(() => {
      if (
        isEditing &&
        inputRef.current &&
        document.activeElement !== inputRef.current
      ) {
        inputRef.current.focus();

        const posAt = (() =>
          startPositionAt ? startPositionAt : noteBlock.content.length)();

        inputRef.current.selectionStart = posAt;
        inputRef.current.selectionEnd = posAt;
      }
    }, [isEditing, startPositionAt, noteBlock.content.length]);

    useEffect(() => {
      if (noteBlock.$modelId !== noteBlockContent.id) return;
      if (noteBlock.content === noteBlockContent.content) return;

      noteBlock.updateContent(noteBlockContent.content);
    }, [noteBlock, noteBlockContent.content, noteBlockContent.id]);

    const handleKeyPress = useCallback(
      async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const newBlock = noteBlock.injectNewRightBlock('');

          if (!newBlock) return;

          setEditState({
            noteBlock: newBlock,
          });
        }
      },
      [setEditState, noteBlock]
    );

    const handleKeyDown = useCallback(
      async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Backspace') {
          const start = e.currentTarget.selectionStart;
          const end = e.currentTarget.selectionEnd;

          const isOnStart = start === end && start === 0;

          if (isOnStart) {
            e.preventDefault();

            const mergedTo = noteBlock.mergeToLeftAndDelete();

            if (mergedTo) {
              setEditState({
                noteBlock: mergedTo,
                startPositionAt:
                  mergedTo.content.length - noteBlock.content.length,
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
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();

          const [, right] = noteBlock.leftAndRight;

          if (right) {
            setEditState({
              noteBlock: right,
            });
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();

          const [left] = noteBlock.leftAndRight;

          if (left) {
            setEditState({ noteBlock: left });
          }
        }
      },
      [noteBlock, setEditState]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNoteBlockContent({
          content: e.target.value,
          id: noteBlock.$modelId,
        });
      },
      [noteBlock.$modelId]
    );

    const handleClick = useCallback(() => {
      setEditState({ noteBlock: noteBlock });
    }, [noteBlock, setEditState]);

    return (
      <div className="note-block">
        <div className="note-block__body">
          <div className="note-block__dot" />
          <TextareaAutosize
            ref={inputRef}
            autoFocus
            className={clsx('note-block__content', { hidden: !isEditing })}
            onKeyDown={handleKeyDown}
            onKeyPress={handleKeyPress}
            onChange={handleChange}
            value={noteBlockContent.content}
          />
          <div
            className={clsx('note-block__content', { hidden: isEditing })}
            onClick={handleClick}
          >
            {noteBlockContent.content}
            {noteBlockContent.content.slice(-1) === '\n' && '\n'}
          </div>
        </div>
        {noteBlock.childBlockRefs.length !== 0 && (
          <div className="note-block__child-blocks">
            {noteBlock.childBlockRefs.map(({ current: childNoteBlock }) => (
              <NoteBlock
                key={childNoteBlock.$modelId}
                noteBlock={childNoteBlock}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);
