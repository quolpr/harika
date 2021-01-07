import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './styles.css';
import { useClickAway } from 'react-use';
import { useContextSelector } from 'use-context-selector';
import clsx from 'clsx';
import TextareaAutosize from 'react-textarea-autosize';
import {
  CurrentFocusedBlockContext,
  useCurrentVault,
} from '@harika/harika-utils';
import { Observer, observer } from 'mobx-react-lite';
import { NoteBlockModel } from '@harika/harika-core';
import ReactMarkdown from 'react-markdown';
import {
  Settings,
  Processor,
  ParserConstructor,
  ParserFunction,
} from 'unified/types';
import { Node } from 'unist';
import visit from 'unist-util-visit';
import { Link } from 'react-router-dom';
import { Arrow } from '../Arrow/Arrow';
import { BlocksViewModel } from 'libs/harika-core/src/lib/harikaVaults/models/BlocksViewModel';

const reBlankLine = /^[ \t]*(\n|$)/;

export function blankLines(this: Processor<Settings>) {
  const parser = this.Parser;

  if (!isRemarkParser(parser)) {
    throw new Error('Missing parser to attach `blankLines` to');
  }

  parser.prototype.blockTokenizers.blankLine = blankLine;
  // NOTE react-markdown@4.3.1 we use depends on remark-parse@5.0.0  while we use remark-parse@8.0.3
  if (parser.prototype.blockMethods.indexOf('blankLine') === -1) {
    parser.prototype.blockMethods.unshift('blankLine');
  }

  function blankLine(
    this: Tokenizer,
    eat: (consumed: string) => (node: Node) => void,
    value: string,
    silent: boolean
  ): true | void {
    let index = 0;
    const length = value.length;
    let eatenLines = 0;
    while (index < length) {
      const match = reBlankLine.exec(value.slice(index));

      if (match == null) {
        break;
      }
      if (silent) {
        return true;
      }
      // debugger;
      const line = match[0];
      index += line.length;

      const add = eat(line);
      // NOTE if we are at start we add break for each line
      // otherwise we ignore first line as it's newline of previous block
      if (this.atStart === true || eatenLines > 0) {
        add({ type: 'break' });
      }
      eatenLines++;
    }
  }
}

const splice = [].splice;

function attacher(this: Processor<Settings>) {
  const parser = this.Parser;

  const inlineMethods = parser.prototype.inlineMethods;

  if (inlineMethods.indexOf('reference') !== -1) {
    inlineMethods.splice(inlineMethods.indexOf('reference'), 1);
  }

  return transformer;

  function transformer(tree, file) {
    visit(tree, 'text', visitor);

    function visitor(node, index, parent) {
      const result = [];
      let start = 0;

      const noteLinkRegex = /\[\[.+?\]\]/g;
      let match = noteLinkRegex.exec(node.value);

      while (match) {
        const position = match.index;
        if (start !== position) {
          result.push({
            type: 'text',
            value: node.value.slice(start, position),
          });
        }

        result.push({
          type: 'noteLink',
          value: match[0],
          data: {
            noteName: match[0].substring(2, match[0].length - 2),
          },
        });

        start = position + match[0].length;
        match = noteLinkRegex.exec(node.value);
      }

      if (result.length > 0) {
        if (start < node.value.length) {
          result.push({ type: 'text', value: node.value.slice(start) });
        }

        splice.apply(parent.children, [index, 1].concat(result));
        // parent.children.splice(index, 1, result);

        return index + result.length;
      }

      // return index;
    }
  }
}

function isRemarkParser(parser: ParserConstructor | ParserFunction) {
  return (
    parser != null &&
    parser.prototype != null &&
    parser.prototype.blockTokenizers != null
  );
}

type Tokenizer = {
  atStart: boolean;
  inBlock: boolean;
  inLink: boolean;
  inList: boolean;
};

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

const plugins = [blankLines, attacher];

const MarkdownRenderer = observer(
  ({ noteBlock, content }: { noteBlock: NoteBlockModel; content: string }) => {
    const links = noteBlock.noteLinks;

    const renderers = useMemo(
      () => ({
        ...ReactMarkdown.renderers,
        noteLink: (node) => {
          return (
            <Observer>
              {() => {
                const link = links.find(
                  (link) => link.noteRef.current.title === node.data.noteName
                );

                return (
                  <Link
                    to={`/notes/${link?.noteRef.id}`}
                    className="text-pink-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {node.value}
                  </Link>
                );
              }}
            </Observer>
          );
        },
      }),
      [links]
    );

    return (
      <ReactMarkdown
        plugins={plugins}
        className="whitespace-pre-wrap"
        children={content}
        renderers={renderers}
      />
    );
  }
);

export const NoteBlock = observer(
  ({
    noteBlock,
    view,
  }: {
    noteBlock: NoteBlockModel;
    view: BlocksViewModel;
  }) => {
    const vault = useCurrentVault();

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
    }, [vault, noteBlock, noteBlockContent.content, noteBlockContent.id]);

    const handleKeyPress = useCallback(
      async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const newBlock = noteBlock.injectNewRightBlock('', view);

          if (!newBlock) return;

          setEditState({
            noteBlock: newBlock,
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

    const handleBlur = useCallback(() => {
      vault.updateNoteBlockLinks(noteBlock);
    }, [noteBlock, vault]);

    return (
      <div className="note-block">
        <div className="note-block__body">
          {noteBlock.children.length !== 0 && (
            <Arrow
              className="note-block__arrow"
              isExpanded={view.isExpanded(noteBlock.$modelId)}
              onToggle={() => {
                view.toggleExpand(noteBlock.$modelId);
              }}
            />
          )}

          <div
            className={clsx('note-block__dot', {
              'note-block__dot--expanded': view.isExpanded(noteBlock.$modelId),
            })}
          />
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
            <div onClick={handleClick} className={clsx('note-block__content')}>
              <MarkdownRenderer
                noteBlock={noteBlock}
                content={noteBlockContent.content}
              />
            </div>
          )}
        </div>
        {view.isExpanded(noteBlock.$modelId) && (
          <NoteBlockChildren childBlocks={noteBlock.children} view={view} />
        )}
      </div>
    );
  }
);
