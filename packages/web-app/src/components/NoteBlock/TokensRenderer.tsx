import { observer } from 'mobx-react-lite';
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { RefToken, NoteBlockModel, Token } from '@harika/web-core';
import { useNoteRepository } from '../../contexts/CurrentNoteRepositoryContext';
import { useCurrentVault } from '../../hooks/useCurrentVault';
import { paths } from '../../paths';

const RefRenderer = observer(
  ({ token, noteBlock }: { token: RefToken; noteBlock: NoteBlockModel }) => {
    const vault = useCurrentVault();
    const noteRepo = useNoteRepository();
    const linkedNotes = noteBlock.linkedNoteRefs;

    const handleTodoToggle = useCallback(
      (e: React.SyntheticEvent) => {
        e.stopPropagation();

        noteBlock.content.toggleTodo(token.id);
        noteRepo.updateNoteBlockLinks(noteBlock);
      },
      [noteBlock, noteRepo, token.id],
    );

    const noteRef = linkedNotes.find((note) => {
      return note.maybeCurrent?.title === token.content;
    });

    if (token.content === 'TODO' || token.content === 'DONE') {
      return (
        <label
          className="checkbox"
          style={{ verticalAlign: 'middle' }}
          data-not-editable
        >
          <input
            type="checkbox"
            checked={token.content === 'DONE'}
            onChange={handleTodoToggle}
            data-not-editable
          />
          <svg className="checkbox__tick" viewBox="0 0 20 20" data-not-editable>
            <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
          </svg>
        </label>
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
        data-not-editable
      >
        [[{token.content}]]
      </Link>
    );
  },
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
              <h3 className="text-xl">
                <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
              </h3>
            );
          } else if (token.depth === 2) {
            return (
              <h2 className="text-2xl">
                <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
              </h2>
            );
          } else {
            return (
              <h1 className="text-3xl">
                <TokensRenderer noteBlock={noteBlock} tokens={token.content} />
              </h1>
            );
          }
        })();
      case 'inlineCode':
        return <pre>{token.content}</pre>;
      case 'codeBlock':
        return <pre>{token.content}</pre>;
      case 'link':
        return (
          <a
            href={token.href}
            className="link"
            target="_blank"
            rel="noopener noreferrer"
            data-not-editable
          >
            {token.content}
          </a>
        );
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
  },
);

export const TokensRenderer = ({
  noteBlock,
  tokens,
}: {
  noteBlock: NoteBlockModel;
  tokens: Token[];
}) => {
  return (
    <>
      {tokens.map((token) => (
        <TokenRenderer
          key={`${token.offsetStart}${token.offsetEnd}`}
          noteBlock={noteBlock}
          token={token}
        />
      ))}
    </>
  );
};
