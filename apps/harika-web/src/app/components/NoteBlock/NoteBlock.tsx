import React, { useCallback, useEffect, useRef, useState } from 'react';
import './styles.css';
import { useClickAway } from 'react-use';
import { CurrentEditContext } from '../../contexts/CurrentEditContent';
import { useContextSelector } from 'use-context-selector';
import clsx from 'clsx';
import TextareaAutosize from 'react-textarea-autosize';
import { NoteBlockDocument } from '../../models/noteBlocks';
import { useIsFocused } from '../../hooks/useIsFocused';

export const NoteBlock = ({ noteBlock }: { noteBlock: NoteBlockDocument }) => {
  const childBlocks = [];

  const [isFocused, attrs] = useIsFocused();

  const [noteBlockContent, setNoteBlockContent] = useState({
    content: noteBlock.content,
    id: noteBlock._id,
  });

  useEffect(() => {
    if (!isFocused) {
      setNoteBlockContent({ content: noteBlock.content, id: noteBlock._id });
    }
  }, [isFocused, noteBlock._id, noteBlock.content]);

  const setEditState = useContextSelector(
    CurrentEditContext,
    ([, setEditState]) => setEditState
  );
  const isEditing = useContextSelector(
    CurrentEditContext,
    ([editState]) => editState?.id === noteBlock._id
  );
  const startPositionAt = useContextSelector(
    CurrentEditContext,
    ([editState]) =>
      editState?.id === noteBlock._id ? editState.startPositionAt : undefined
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
    if (noteBlock._id !== noteBlockContent.id) return;
    if (noteBlock.content === noteBlockContent.content) return;

    noteBlock.updateContent(noteBlockContent.content);
  }, [noteBlock, noteBlockContent.content, noteBlockContent.id]);

  const handleKeyPress = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const newBlock = await noteBlock.injectNewRightBlock('');

        setEditState({
          id: newBlock._id,
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
              id: mergedTo._id,
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
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();

        const [, right] = await noteBlock.getLeftAndRight();

        if (right) {
          setEditState({
            id: right._id,
          });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();

        const [left] = await noteBlock.getLeftAndRight();

        if (left) {
          setEditState({ id: left._id });
        }
      }
    },
    [noteBlock, setEditState]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNoteBlockContent({ content: e.target.value, id: noteBlock._id });
    },
    [noteBlock._id]
  );

  const handleClick = useCallback(() => {
    setEditState({ id: noteBlock._id });
  }, [noteBlock._id, setEditState]);

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
          {...attrs}
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
          {childBlocks.map((childNoteBlock) => (
            <NoteBlock key={childNoteBlock.id} noteBlock={childNoteBlock} />
          ))}
        </div>
      )}
    </div>
  );
};
