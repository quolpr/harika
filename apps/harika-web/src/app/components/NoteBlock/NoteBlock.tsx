import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './styles.css';
import { useClickAway } from 'react-use';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { CurrentEditContext } from '../../contexts/CurrentEditContent';
import { NoteBlock as NoteBlockModel } from '@harika/harika-notes';
import ContentEditable, { ContentEditableEvent } from 'react-contenteditable';
import { useContextSelector } from 'use-context-selector';
import sanitizeHtml from 'sanitize-html';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import clsx from 'clsx';
import { useTable } from '../../hooks/useTable';

const plugins = [remarkBreaks];

export const NoteBlock = React.memo(
  ({ noteBlock }: { noteBlock: NoteBlockModel }) => {
    const database = useDatabase();

    noteBlock = useTable(noteBlock);
    const childBlocks = useTable(noteBlock.childBlocks);

    const [noteBlockContent, setNoteBlockContent] = useState({
      content: noteBlock.content,
      id: noteBlock.id,
    });

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
      if (noteBlock.id !== noteBlockContent.id) return;
      if (noteBlock.content === noteBlockContent.content) return;

      database.action(async () => {
        await noteBlock.update((post) => {
          post.content = noteBlockContent.content;
        });
      });
    }, [database, noteBlock, noteBlockContent.content, noteBlockContent.id]);

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
      (e: ContentEditableEvent) => {
        setNoteBlockContent({ content: e.target.value, id: noteBlock.id });
      },
      [noteBlock.id]
    );

    const handleClick = useCallback(() => {
      // const startAt = window.getSelection()?.getRangeAt(0)?.startOffset;
      //
      console.log(window.getSelection()?.getRangeAt(0)?.cloneRange());

      setEditState({ id: noteBlock.id });
    }, [noteBlock.id, setEditState]);

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();

        // get text representation of clipboard
        const text = e.clipboardData.getData('text/plain');

        // insert text manually
        document.execCommand('insertHTML', false, text);
      },
      []
    );

    const renderers = useMemo(() => {
      const root: React.FC<{ className?: string }> = ({
        children,
        className,
      }) => {
        return (
          <div className={className} onClick={handleClick}>
            {children}
          </div>
        );
      };

      return {
        root,
      };
    }, [handleClick]);

    const handleBlur = useCallback(() => {
      noteBlock.createNotesAndRefsIfNeeded();
    }, [noteBlock]);

    return (
      <div className="note-block">
        <div className="note-block__body">
          <div className="note-block__dot" />({noteBlock.order})
          <ContentEditable
            innerRef={inputRef}
            className={clsx('note-block__content', { hidden: !isEditing })}
            contentEditable={true}
            onKeyDown={handleKeyDown}
            onKeyPress={handleKeyPress}
            onChange={handleChange}
            onBlur={handleBlur}
            html={sanitizeHtml(noteBlockContent.content)}
            onPaste={handlePaste}
          />
          <ReactMarkdown
            plugins={plugins}
            renderers={renderers}
            children={noteBlockContent.content}
            className={clsx('note-block__content', { hidden: isEditing })}
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
  }
);
