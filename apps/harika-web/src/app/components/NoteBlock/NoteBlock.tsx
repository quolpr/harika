import withObservables from '@nozbe/with-observables';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './styles.css';
import { useClickAway } from 'react-use';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { CurrentEditContext } from '../CurrentEditContent';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import ContentEditable, { ContentEditableEvent } from 'react-contenteditable';
import { useContextSelector } from 'use-context-selector';

type InputProps = { noteBlock: NoteBlockModel };

export const NoteBlockComponent = ({
  noteBlock,
  childBlocks,
}: InputProps & { childBlocks: NoteBlockModel[] }) => {
  const database = useDatabase();
  const [content, setContent] = useState(noteBlock.content);
  const setEditState = useContextSelector(
    CurrentEditContext,
    ([, setEditState]) => setEditState
  );
  const isEditing = useContextSelector(
    CurrentEditContext,
    ([editState]) => editState?.id === noteBlock.id
  );
  const startPositionAt = useContextSelector(
    CurrentEditContext,
    ([editState]) =>
      editState?.id === noteBlock.id ? editState.startPositionAt : undefined
  );

  const inputRef = useRef<HTMLDivElement | null>(null);

  useClickAway(inputRef, () => {
    if (isEditing) {
      setEditState(undefined);
    }
  });

  useEffect(() => {
    setContent(noteBlock.content);
  }, [noteBlock.content]);

  useEffect(() => {
    if (
      isEditing &&
      inputRef.current &&
      document.activeElement !== inputRef.current
    ) {
      inputRef.current.focus();

      const posAt = (() =>
        startPositionAt ? startPositionAt : noteBlock.content.length)();

      if (posAt === 0) return;

      try {
        const range = document.createRange();
        const sel = window.getSelection();
        if (!sel) return;
        range.setStart(inputRef.current.childNodes[0], posAt);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
        console.error('Failed to set start position!');
      }
    }
  }, [isEditing, startPositionAt, noteBlock.content.length]);

  useEffect(() => {
    if (noteBlock.content === content) return;

    database.action(async () => {
      await noteBlock.update((post) => {
        post.content = content;
      });
    });
  }, [content, database, noteBlock]);

  const handleKeyPress = useCallback(
    async (e: React.KeyboardEvent<HTMLDivElement>) => {
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
    async (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Backspace') {
        const _range = document.getSelection()?.getRangeAt(0);
        if (!_range) return;
        const range = _range.cloneRange();
        range.selectNodeContents(e.currentTarget);
        range.setEnd(_range.endContainer, _range.endOffset);
        const isOnStart = range.toString().length === 0;

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
      } else if (e.key === 'ArrowDown') {
        const [, right] = await noteBlock.getLeftAndRight();

        if (right) {
          setEditState({
            id: right.id,
          });
        }
      } else if (e.key === 'ArrowUp') {
        const [left] = await noteBlock.getLeftAndRight();

        if (left) {
          setEditState({ id: left.id });
        }
      }
    },
    [noteBlock, setEditState]
  );

  const handleChange = useCallback((e: ContentEditableEvent) => {
    setContent(e.target.value);
  }, []);

  return (
    <div className="note-block">
      <div className="note-block__body">
        <div className="note-block__dot" />({noteBlock.order})
        <ContentEditable
          innerRef={inputRef}
          className="note-block__content"
          onClick={() =>
            setEditState({
              id: noteBlock.id,
            })
          }
          contentEditable={true}
          onKeyDown={handleKeyDown}
          onKeyPress={handleKeyPress}
          onChange={handleChange}
          html={content}
        />
      </div>
      {childBlocks.length !== 0 && (
        <div className="note-block__child-blocks">
          {childBlocks
            .sort((a, b) => a.order - b.order)
            .map((childNoteBlock) => (
              <NoteBlock key={childNoteBlock.id} noteBlock={childNoteBlock} />
            ))}
        </div>
      )}
    </div>
  );
};

const enhance = withObservables(['noteBlock'], ({ noteBlock }) => ({
  noteBlock,
  childBlocks: noteBlock.childBlocks,
}));

export const NoteBlock = React.memo(
  enhance(NoteBlockComponent) as React.FC<InputProps>
);
