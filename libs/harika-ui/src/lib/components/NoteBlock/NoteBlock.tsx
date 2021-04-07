import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import './styles.css';
import { useClickAway, usePrevious } from 'react-use';
import clsx from 'clsx';
import TextareaAutosize from 'react-textarea-autosize';
import { Observer, observer } from 'mobx-react-lite';
import {
  BlocksViewModel,
  NoteBlockModel,
  RefToken,
  Token,
} from '@harika/harika-core';
import { Arrow } from '../Arrow/Arrow';
import { computed } from 'mobx';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentFocusedBlockState } from '../../hooks/useFocusedBlockState';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import { isIOS } from '../../utils';
import { Ref } from 'mobx-keystone';

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

const TokensRenderer = ({
  noteBlock,
  tokens,
}: {
  noteBlock: NoteBlockModel;
  tokens: Token[];
}) => {
  return (
    <>
      {tokens.map((token, i) => (
        <TokenRenderer key={i} noteBlock={noteBlock} token={token} />
      ))}
    </>
  );
};

const RefRenderer = observer(
  ({ token, noteBlock }: { token: RefToken; noteBlock: NoteBlockModel }) => {
    const vault = useCurrentVault();
    const linkedNotes = noteBlock.linkedNoteRefs;

    const noteRef = linkedNotes.find((note) => {
      try {
        return note.current.title === token.content;
      } catch {
        return false;
      }
    });

    if (!noteRef) return <>[[{token.content}]]</>;

    return (
      <Link
        to={paths.vaultNotePath({
          vaultId: vault.$modelId,
          noteId: noteRef?.id,
        })}
        className="link"
        onClick={(e) => e.stopPropagation()}
      >
        [[{token.content}]]
      </Link>
    );
  }
);

const TokenRenderer = observer(
  ({ noteBlock, token }: { noteBlock: NoteBlockModel; token: Token }) => {
    switch (token.type) {
      case 'tag':
        return <a href="#">#[[{token.content}]]</a>;
      case 'ref':
        return <RefRenderer token={token} noteBlock={noteBlock} />;
      case 'bold':
        return (
          <b>
            <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
          </b>
        );
      case 'italic':
        return (
          <i>
            <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
          </i>
        );
      case 'highlight':
        return (
          <mark>
            <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
          </mark>
        );
      case 'head':
        return (() => {
          if (token.depth === 3) {
            return (
              <h3>
                <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
              </h3>
            );
          } else if (token.depth === 2) {
            return (
              <h2>
                <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
              </h2>
            );
          } else {
            return (
              <h1>
                <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
              </h1>
            );
          }
        })();
      case 'inlineCode':
        return <pre>{token.content}</pre>;
      case 'codeBlock':
        return <pre>{token.content}</pre>;
      case 'str':
        return <>{token.content}</>;
      default:
        return <span></span>;
    }
  }
);

const MarkdownRenderer = ({
  noteBlock,
  content,
}: {
  noteBlock: NoteBlockModel;
  content: string;
}) => {
  return (
    <TokensRenderer noteBlock={noteBlock} tokens={noteBlock.content.ast} />
  );
};

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

    const [editState, setEditState] = useCurrentFocusedBlockState(
      view.$modelId,
      noteBlock.$modelId
    );

    const wasEditing = usePrevious(editState.isEditing);

    const { isFocused, startAt, isEditing } = editState;

    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    useClickAway(inputRef, (e) => {
      if (
        isEditing &&
        !(
          e.target instanceof Element &&
          e.target.closest('.toolbar') &&
          !e.target.closest('[data-defocus]')
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
        inputRef.current.focus();

        const posAt = (() =>
          startAt ? startAt : noteBlock.content.value.length)();

        inputRef.current.selectionStart = posAt;
        inputRef.current.selectionEnd = posAt;
      }
    }, [isFocused, isEditing, startAt, noteBlock.content.value.length]);

    const handleKeyPress = useCallback(
      async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // on ios sometime shiftKey === caps lock
        if (e.key === 'Enter' && (isIOS || !e.shiftKey)) {
          e.preventDefault();
          const newBlock = noteBlock.injectNewRightBlock('', view);

          if (!newBlock) return;

          setEditState({
            viewId: view.$modelId,
            blockId: newBlock.$modelId,
            isEditing: true,
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
        }
      },
      [noteBlock, setEditState, view.$modelId]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        noteBlock.content.update(e.target.value);
      },
      [noteBlock]
    );

    const handleClick = useCallback(() => {
      setEditState({
        viewId: view.$modelId,
        blockId: noteBlock.$modelId,
        isEditing: true,
      });
    }, [noteBlock.$modelId, setEditState, view.$modelId]);

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
              autoFocus
              className={clsx('note-block__content', {
                'note-block__content--hidden': !isEditing,
              })}
              onKeyDown={handleKeyDown}
              onKeyPress={handleKeyPress}
              onChange={handleChange}
              value={noteBlock.content.value}
            />
          )}
          {!isEditing && (
            <div
              onClick={handleClick}
              className={clsx('note-block__content', {
                'note-block__content--focused': isFocused,
              })}
            >
              <TokensRenderer
                noteBlock={noteBlock}
                tokens={noteBlock.content.ast}
              />
            </div>
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
