import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './styles.css';
import { useClickAway } from 'react-use';
import clsx from 'clsx';
import TextareaAutosize from 'react-textarea-autosize';
import { Observer, observer } from 'mobx-react-lite';
import {
  blockParser,
  BlocksViewModel,
  NoteBlockModel,
  Token,
} from '@harika/harika-core';
import { Arrow } from '../Arrow/Arrow';
import { computed } from 'mobx';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentFocusedBlockState } from '../../hooks/useFocusedBlockState';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { Link } from 'react-router-dom';
import { paths } from '../../paths';

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

const TokenRenderer = ({
  noteBlock,
  token,
}: {
  noteBlock: NoteBlockModel;
  token: Token;
}) => {
  const vault = useCurrentVault();
  const links = noteBlock.noteLinks;

  switch (token.type) {
    case 'tag':
      return <a href="#">#[[{token.content}]]</a>;
    case 'ref':
      return (
        <Observer>
          {() => {
            const link = links.find(
              (link) => link.noteRef?.current.title === token.content
            );

            if (!link) return <>[[{token.content}]]</>;

            return (
              <Link
                to={paths.vaultNotePath({
                  vaultId: vault.$modelId,
                  noteId: link?.noteRef.id,
                })}
                className="text-pink-500 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                [[{token.content}]]
              </Link>
            );
          }}
        </Observer>
      );
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
};

const MarkdownRenderer = ({
  noteBlock,
  content,
}: {
  noteBlock: NoteBlockModel;
  content: string;
}) => {
  const rendered = useMemo(
    () => (
      <TokensRenderer
        noteBlock={noteBlock}
        tokens={blockParser.parse(content)}
      />
    ),
    [content, noteBlock]
  );

  return <div>{rendered}</div>;
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

    const { isFocused, startAt, isEditing } = editState;

    const [noteBlockContent, setNoteBlockContent] = useState({
      content: noteBlock.content,
      id: noteBlock.$modelId,
    });

    /* useEffect(() => { */
    /*   if ( */
    /*     noteBlock.content === noteBlockContent.content && */
    /*     noteBlock.$modelId === noteBlockContent.id */
    /*   ) */
    /*     return; */

    /*   setNoteBlockContent({ */
    /*     content: noteBlock.content, */
    /*     id: noteBlock.$modelId, */
    /*   }); */
    /* }, [ */
    /*   noteBlock.$modelId, */
    /*   noteBlock.content, */
    /*   noteBlockContent.content, */
    /*   noteBlockContent.id, */
    /* ]); */

    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    /* useClickAway(inputRef, () => { */
    /*   if (isEditing) { */
    /*     setEditState({ */
    /*       viewId: view.$modelId, */
    /*       blockId: noteBlock.$modelId, */
    /*       isEditing: false, */
    /*     }); */
    /*   } */
    /* }); */

    useEffect(() => {
      if (
        isEditing &&
        inputRef.current &&
        document.activeElement !== inputRef.current
      ) {
        inputRef.current.focus();

        const posAt = (() => (startAt ? startAt : noteBlock.content.length))();

        inputRef.current.selectionStart = posAt;
        inputRef.current.selectionEnd = posAt;
      }
    }, [isFocused, isEditing, startAt, noteBlock.content.length]);

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
                startAt: mergedTo.content.length - noteBlock.content.length,
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
        if (e.target.value === noteBlockContent.content) return;

        setNoteBlockContent({
          content: e.target.value,
          id: noteBlock.$modelId,
        });
      },
      [noteBlock.$modelId, noteBlockContent.content]
    );

    const handleClick = useCallback(() => {
      setEditState({
        viewId: view.$modelId,
        blockId: noteBlock.$modelId,
        isEditing: true,
      });
    }, [noteBlock.$modelId, setEditState, view.$modelId]);

    const handleBlur = useCallback(() => {
      noteRepo.updateNoteBlockLinks(vault, noteBlock);
      /* setEditState({ */
      /*   viewId: view.$modelId, */
      /*   blockId: noteBlock.$modelId, */
      /*   isEditing: false, */
      /* }); */
    }, [noteBlock, vault, noteRepo, setEditState, view.$modelId]);

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
          {/* <div */}
          {/*   className={clsx('note-block__outline', { */}
          {/*     'note-block__outline--show': isFocused, */}
          {/*   })} */}
          {/* > */}
          <TextareaAutosize
            ref={inputRef}
            autoFocus
            className={clsx('note-block__content', { hidden: !isEditing })}
            onKeyDown={handleKeyDown}
            onKeyPress={handleKeyPress}
            onChange={handleChange}
            value={noteBlockContent.content}
            onBlur={handleBlur}
          />
          {!isEditing && (
            <div
              onClick={handleClick}
              className={clsx('note-block__content', {
                'note-block__content--focused': isFocused,
              })}
            >
              <MarkdownRenderer
                noteBlock={noteBlock}
                content={noteBlockContent.content}
              />
            </div>
          )}
          {/* </div> */}
        </div>
        {isExpanded && (
          <NoteBlockChildren childBlocks={noteBlock.children} view={view} />
        )}
      </div>
    );
  }
);
