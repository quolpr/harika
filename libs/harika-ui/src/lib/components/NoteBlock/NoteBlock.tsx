import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
} from '@harika/harika-front-core';
import { Arrow } from '../Arrow/Arrow';
import { computed } from 'mobx';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentFocusedBlockState } from '../../hooks/useFocusedBlockState';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';
import { isIOS } from '../../utils';
import { Ref } from 'mobx-keystone';
import { position, offset } from 'caret-pos';
import { useCurrentVaultUiState } from '../../contexts/CurrentVaultUiStateContext';

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
    const noteRepo = useNoteRepository();
    const linkedNotes = noteBlock.linkedNoteRefs;

    const handleTodoToggle = useCallback(() => {
      noteBlock.content.toggleTodo(token.id);
      noteRepo.updateNoteBlockLinks(vault, noteBlock);
    }, [noteBlock, noteRepo, token.id, vault]);

    const noteRef = linkedNotes.find((note) => {
      try {
        return note.current.title === token.content;
      } catch {
        return false;
      }
    });

    if (token.content === 'TODO' || token.content === 'DONE') {
      console.log(token.content);
      return (
        <span className="checkbox">
          <input
            type="checkbox"
            checked={token.content === 'DONE'}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onChange={handleTodoToggle}
          />
          <svg className="checkbox__tick" viewBox="0 0 20 20">
            <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
          </svg>
        </span>
      );
    }

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
        return (
          <span
            data-offset-start={token.offsetStart}
            data-offset-end={token.offsetEnd}
            style={{
              userSelect: 'text',
            }}
          >
            {token.content}
          </span>
        );
      default:
        return <span></span>;
    }
  }
);

// https://stackoverflow.com/a/55652503/3872807
const useFakeInput = () => {
  const fakeInputRef = useRef<HTMLInputElement | null>(null);

  const insertFakeInput = useCallback((el?: HTMLElement) => {
    // create invisible dummy input to receive the focus first
    const fakeInput = document.createElement('input');
    fakeInput.setAttribute('type', 'text');
    fakeInput.style.position = 'absolute';
    fakeInput.style.fontSize = '16px'; // disable auto zoom
    fakeInput.style.width = '5px';
    fakeInput.style.height = '5px';
    fakeInput.style.opacity = '0.1';
    fakeInput.style.backgroundColor = '#000';

    // you may need to append to another element depending on the browser's auto
    // zoom/scroll behavior
    (el || document.body).prepend(fakeInput);

    // focus so that subsequent async focus will work
    fakeInput.focus();
    fakeInputRef.current = fakeInput;
    // Fake input end
  }, []);

  const releaseFakeInput = useCallback(() => {
    if (fakeInputRef.current) {
      fakeInputRef.current.remove();
      fakeInputRef.current = null;
    }
  }, []);

  useEffect(() => releaseFakeInput, [releaseFakeInput]);

  return { insertFakeInput, releaseFakeInput, fakeInputRef };
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

    const getHtmlElId = useCallback(
      (blockId: string) => `block-${view.$modelId}-${blockId}`,
      [view.$modelId]
    );
    const htmlElId = getHtmlElId(noteBlock.$modelId);

    const noteBlockRef = useRef<HTMLDivElement>(null);

    const [editState, setEditState] = useCurrentFocusedBlockState(
      view.$modelId,
      noteBlock.$modelId
    );

    const wasEditing = usePrevious(editState.isEditing);

    const { isFocused, startAt, isEditing } = editState;

    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    const { insertFakeInput, releaseFakeInput, fakeInputRef } = useFakeInput();

    const [wasBlurred, setWasBlurred] = useState(false);

    const handleBlur = useCallback(() => {
      setWasBlurred(true);
    }, []);

    // When `Done` button clicked on iOS keybaord
    useEffect(() => {
      if (wasBlurred && isEditing) {
        setEditState({
          viewId: view.$modelId,
          blockId: noteBlock.$modelId,
          isEditing: false,
        });
      }
      setWasBlurred(false);
    }, [
      wasBlurred,
      isEditing,
      setEditState,
      view.$modelId,
      noteBlock.$modelId,
    ]);

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
          const newBlock = noteBlock.injectNewRightBlock('', view);

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
          });
        }
      },
      [noteBlock, view, insertFakeInput, releaseFakeInput, setEditState]
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
      [insertFakeInput, noteBlock, setEditState, view.$modelId]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        noteBlock.content.update(e.target.value);
      },
      [noteBlock]
    );

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const selection = window.getSelection();

        let startAt = 0;

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
      [insertFakeInput, noteBlock.$modelId, setEditState, view.$modelId]
    );

    useEffect(() => {
      if (!editState.isEditing && wasEditing) {
        noteRepo.updateNoteBlockLinks(vault, noteBlock);
      }
    }, [editState.isEditing, noteBlock, noteRepo, vault, wasEditing]);

    return (
      <div
        id={htmlElId}
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
