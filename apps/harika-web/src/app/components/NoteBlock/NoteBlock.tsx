import React, { useCallback, useEffect, useRef, useState } from 'react';
import './styles.css';
import { useClickAway, usePrevious, useUpdate } from 'react-use';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import { useContextSelector } from 'use-context-selector';
import clsx from 'clsx';
import TextareaAutosize from 'react-textarea-autosize';
import {
  CurrentFocusedBlockContext,
  useTable,
  useTrackOrder,
} from '@harika/harika-core';

export const NoteBlock = React.memo(
  ({
    noteBlock,
    onOrderChange,
  }: {
    noteBlock: NoteBlockModel;
    onOrderChange: () => void;
  }) => {
    const database = useDatabase();
    const update = useUpdate();

    noteBlock = useTable(noteBlock);
    const childBlocks = useTable(noteBlock.childBlocks);

    const [noteBlockContent, setNoteBlockContent] = useState({
      content: noteBlock.content,
      id: noteBlock.id,
    });

    useEffect(() => {
      setNoteBlockContent({ content: noteBlock.content, id: noteBlock.id });
    }, [noteBlock.id, noteBlock.content]);

    const setEditState = useContextSelector(
      CurrentFocusedBlockContext,
      ([, setEditState]) => setEditState
    );
    const isEditing = useContextSelector(
      CurrentFocusedBlockContext,
      ([editState]) => editState?.id === noteBlock.id
    );
    const startPositionAt = useContextSelector(
      CurrentFocusedBlockContext,
      ([editState]) =>
        editState?.id === noteBlock.id ? editState.startPositionAt : undefined
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
      if (noteBlock.id !== noteBlockContent.id) return;
      if (noteBlock.content === noteBlockContent.content) return;

      database.action(async () => {
        await noteBlock.update((post) => {
          post.content = noteBlockContent.content;
        });
      });
    }, [database, noteBlock, noteBlockContent.content, noteBlockContent.id]);

    const handleKeyPress = useCallback(
      async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const newBlock = await noteBlock.injectNewRightBlock('');

          setEditState({
            id: newBlock.id,
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

            const mergedTo = await noteBlock.mergeToLeftAndDelete();

            if (mergedTo) {
              setEditState({
                id: mergedTo.id,
                startPositionAt:
                  mergedTo.content.length - noteBlock.content.length,
              });
            }
          }
        } else if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();

          await noteBlock.tryMoveUp();
        } else if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();

          await noteBlock.tryMoveDown();
        } else if (e.key === 'ArrowUp' && e.shiftKey) {
          e.preventDefault();

          await noteBlock.tryMoveLeft();
        } else if (e.key === 'ArrowDown' && e.shiftKey) {
          e.preventDefault();

          await noteBlock.tryMoveRight();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();

          const [, right] = await noteBlock.getLeftAndRight();

          if (right) {
            setEditState({
              id: right.id,
            });
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();

          const [left] = await noteBlock.getLeftAndRight();

          if (left) {
            setEditState({ id: left.id });
          }
        }
      },
      [noteBlock, setEditState]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNoteBlockContent({ content: e.target.value, id: noteBlock.id });
      },
      [noteBlock.id]
    );

    const handleClick = useCallback(() => {
      setEditState({ id: noteBlock.id });
    }, [noteBlock.id, setEditState]);

    useTrackOrder(noteBlock, onOrderChange);

    return (
      <div className="note-block">
        <div className="note-block__body">
          <div className="note-block__dot" />({noteBlock.order})
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
        {childBlocks.length !== 0 && (
          <div className="note-block__child-blocks">
            {childBlocks
              .sort((a, b) => a.order - b.order)
              .map((childNoteBlock) => (
                <NoteBlock
                  key={childNoteBlock.id}
                  noteBlock={childNoteBlock}
                  onOrderChange={update}
                />
              ))}
          </div>
        )}
      </div>
    );
  }
);
