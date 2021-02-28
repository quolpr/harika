import React, { useCallback, useEffect, useRef, useState } from 'react';
import './styles.css';
import { useClickAway } from 'react-use';
import clsx from 'clsx';
import TextareaAutosize from 'react-textarea-autosize';
import { observer } from 'mobx-react-lite';
import { BlocksViewModel, NoteBlockModel } from '@harika/harika-core';
import { Arrow } from '../Arrow/Arrow';
import { computed } from 'mobx';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentFocusedBlockState } from '../../hooks/useFocusedBlockState';
import { useCurrentVault } from '../../hooks/useCurrentVault';

const NoteBlockChildren = observer(
  ({
    childBlocks,
    view,
  }: {
    childBlocks: NoteBlockModel[];
    view: BlocksViewModel;
  }) => {
    return childBlocks.length !== 0 ? (
      <div className="note-block__child-blocks">
        {childBlocks.map((childNoteBlock) => (
          <NoteBlock
            key={childNoteBlock.$modelId}
            noteBlock={childNoteBlock}
            view={view}
          />
        ))}
      </div>
    ) : null;
  }
);

const MarkdownRenderer = observer(
  ({ noteBlock, content }: { noteBlock: NoteBlockModel; content: string }) => {
    /* const vault = useCurrentVault(); */
    /* const links = noteBlock.noteLinks; */

    /* const renderers = useMemo( */
    /*   () => ({ */
    /*     ...ReactMarkdown.renderers, */
    /*     noteLink: (node) => { */
    /*       return ( */
    /*         <Observer> */
    /*           {() => { */
    /*             const link = links.find( */
    /*               (link) => link.noteRef.current.title === node.data.noteName */
    /*             ); */

    /*             if (!link) return node.value; */

    /*             return ( */
    /*               <Link */
    /*                 to={paths.vaultNotePath({ */
    /*                   vaultId: vault.$modelId, */
    /*                   noteId: link?.noteRef.id, */
    /*                 })} */
    /*                 className="text-pink-500 hover:underline" */
    /*                 onClick={(e) => e.stopPropagation()} */
    /*               > */
    /*                 {node.value} */
    /*               </Link> */
    /*             ); */
    /*           }} */
    /*         </Observer> */
    /*       ); */
    /*     }, */
    /*   }), */
    /*   [links, vault.$modelId] */
    /* ); */

    return <div>{content}</div>;
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

    const [{ isFocused, startAt }, setEditState] = useCurrentFocusedBlockState(
      view.$modelId,
      noteBlock.$modelId
    );

    const [noteBlockContent, setNoteBlockContent] = useState({
      content: noteBlock.content,
      id: noteBlock.$modelId,
    });

    useEffect(() => {
      if (
        noteBlock.content === noteBlockContent.content &&
        noteBlock.$modelId === noteBlockContent.id
      )
        return;

      setNoteBlockContent({
        content: noteBlock.content,
        id: noteBlock.$modelId,
      });
    }, [noteBlock.$modelId, noteBlock.content]);

    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    useClickAway(inputRef, () => {
      if (isFocused) {
        setEditState(undefined);
      }
    });

    useEffect(() => {
      if (
        isFocused &&
        inputRef.current &&
        document.activeElement !== inputRef.current
      ) {
        inputRef.current.focus();

        const posAt = (() => (startAt ? startAt : noteBlock.content.length))();

        inputRef.current.selectionStart = posAt;
        inputRef.current.selectionEnd = posAt;
      }
    }, [isFocused, startAt, noteBlock.content.length]);

    useEffect(() => {
      if (noteBlock.$modelId !== noteBlockContent.id) return;
      if (noteBlock.content === noteBlockContent.content) return;

      noteBlock.updateContent(noteBlockContent.content);
    }, [vault, noteBlock, noteBlockContent.content, noteBlockContent.id]);

    const handleKeyPress = useCallback(
      async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const newBlock = noteBlock.injectNewRightBlock('', view);

          if (!newBlock) return;

          setEditState({
            viewId: view.$modelId,
            blockId: newBlock.$modelId,
          });
        }
      },
      [setEditState, noteBlock, view]
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
                viewId: view.$modelId,
                blockId: mergedTo.$modelId,
                startAt: mergedTo.content.length - noteBlock.content.length,
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
              viewId: view.$modelId,
              blockId: right.$modelId,
            });
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();

          const [left] = noteBlock.leftAndRight;

          if (left) {
            setEditState({ viewId: view.$modelId, blockId: left.$modelId });
          }
        }
      },
      [noteBlock, setEditState, view.$modelId]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (e.target.value === noteBlockContent.content) return;

        setNoteBlockContent({
          content: e.target.value,
          id: noteBlock.$modelId,
        });
      },
      [noteBlock.$modelId, noteBlockContent.content]
    );

    const handleClick = useCallback(() => {
      setEditState({ viewId: view.$modelId, blockId: noteBlock.$modelId });
    }, [noteBlock.$modelId, setEditState, view.$modelId]);

    const handleBlur = useCallback(() => {
      noteRepo.updateNoteBlockLinks(vault, noteBlock);
    }, [noteBlock, vault, noteRepo]);

    return (
      <div className="note-block">
        <div className="note-block__body">
          {noteBlock.hasChildren && (
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
          <TextareaAutosize
            ref={inputRef}
            autoFocus
            className={clsx('note-block__content', { hidden: !isFocused })}
            onKeyDown={handleKeyDown}
            onKeyPress={handleKeyPress}
            onChange={handleChange}
            value={noteBlockContent.content}
            onBlur={handleBlur}
          />
          {!isFocused && (
            <div onClick={handleClick} className={clsx('note-block__content')}>
              <MarkdownRenderer
                noteBlock={noteBlock}
                content={noteBlockContent.content}
              />
            </div>
          )}
        </div>
        {isExpanded && (
          <NoteBlockChildren childBlocks={noteBlock.children} view={view} />
        )}
      </div>
    );
  }
);
